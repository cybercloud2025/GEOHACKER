import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rpc, intentar, onSessionExpired, mensajeDeCodigo } from '../lib/api';
import { sendWelcomeEmail, sendVerificationRequestEmail } from '../lib/email';

export interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    employee_email?: string | null;
    avatar_url?: string | null;
    role: string;
    /** Sustituye a la comparación de `invite_code` contra 'CORP-18EC'. */
    is_master: boolean;
    admin_id?: string | null;
    invite_code?: string | null;
    verified?: boolean;
    company_name?: string | null;
    fiscal_id?: string | null;
}

/** Lo que devuelven login/registro: el empleado más el token de sesión. */
type SesionRpc = Employee & { token: string; admin_email?: string | null };

/**
 * login_with_pin devuelve { error } en vez de lanzar excepción: si lanzara, la
 * transacción se revertiría y con ella el contador de intentos fallidos.
 */
type LoginRpc = SesionRpc & { error?: string };

type Resultado = { success: boolean; error?: string };

interface SesionGuardada {
    employee: Employee;
    token: string;
}

interface AuthState {
    employee: Employee | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRegistrationEnabled: boolean;
    /** Sesión del maestro mientras suplanta a otro usuario. */
    originalAdmin: SesionGuardada | null;

    fetchSettings: () => Promise<void>;
    toggleRegistration: (enabled: boolean) => Promise<Resultado>;
    loginWithPin: (pin: string) => Promise<Resultado>;
    register: (
        firstName: string, lastName: string, pin: string,
        email?: string | null, avatarUrl?: string | null, inviteCode?: string | null
    ) => Promise<Resultado>;
    createAdmin: (
        firstName: string, lastName: string, pin: string,
        email?: string | null, avatarUrl?: string | null,
        companyName?: string | null, fiscalId?: string | null
    ) => Promise<Resultado>;
    createUser: (
        firstName: string, lastName: string, pin: string,
        email?: string | null, avatarUrl?: string | null
    ) => Promise<Resultado>;
    updateEmployee: (id: string, data: {
        first_name?: string; last_name?: string; employee_email?: string | null;
        pin_text?: string; company_name?: string | null; fiscal_id?: string | null;
    }) => Promise<Resultado>;
    verifyEmployee: (id: string) => Promise<Resultado>;
    assignEmployee: (id: string, adminId: string) => Promise<Resultado>;
    setRole: (id: string, role: 'admin' | 'employee') => Promise<Resultado>;
    deleteEmployee: (id: string) => Promise<Resultado>;
    regenerateInviteCode: (id: string) => Promise<Resultado>;
    refreshMe: () => Promise<void>;
    impersonate: (targetId: string) => Promise<Resultado>;
    logout: () => Promise<void>;
    clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            employee: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            isRegistrationEnabled: true,
            originalAdmin: null,

            clearSession: () =>
                set({ employee: null, token: null, isAuthenticated: false, originalAdmin: null }),

            fetchSettings: async () => {
                try {
                    const data = await rpc<{ registrations_enabled: boolean }>('get_public_settings');
                    set({ isRegistrationEnabled: !!data?.registrations_enabled });
                } catch (err) {
                    console.error('Error al leer los ajustes:', err);
                }
            },

            toggleRegistration: async (enabled) => {
                const r = await intentar(() =>
                    rpc<void>('admin_set_registration_enabled', {
                        p_token: get().token,
                        p_enabled: enabled,
                    })
                );
                if (r.success) set({ isRegistrationEnabled: enabled });
                return { success: r.success, error: r.error };
            },

            loginWithPin: async (pin) => {
                set({ isLoading: true });
                const r = await intentar(() => rpc<LoginRpc>('login_with_pin', { p_pin: pin }));
                set({ isLoading: false });

                if (!r.success || !r.data) return { success: false, error: r.error };
                if (r.data.error) return { success: false, error: mensajeDeCodigo(r.data.error) };

                const { token, error: _sinError, ...employee } = r.data;
                void _sinError;
                set({ employee, token, isAuthenticated: true, originalAdmin: null });
                return { success: true };
            },

            // Alta pública de empleado con código de organización: entra directo.
            register: async (firstName, lastName, pin, email = null, avatarUrl = null, inviteCode = null) => {
                set({ isLoading: true });
                const limpio = {
                    nombre: firstName.trim(),
                    apellidos: lastName.trim(),
                    pin: pin.trim(),
                    email: email?.trim() || null,
                };

                const r = await intentar(() =>
                    rpc<SesionRpc>('register_employee', {
                        p_first_name: limpio.nombre,
                        p_last_name: limpio.apellidos,
                        p_pin: limpio.pin,
                        p_email: limpio.email,
                        p_avatar_url: avatarUrl,
                        p_invite_code: inviteCode,
                    })
                );
                set({ isLoading: false });

                if (!r.success || !r.data) return { success: false, error: r.error };

                const { token, admin_email, ...employee } = r.data;
                set({ employee, token, isAuthenticated: true, originalAdmin: null });

                // Avisos por EmailJS (no bloqueamos la interfaz esperándolos).
                if (limpio.email) {
                    void sendWelcomeEmail(
                        `${limpio.nombre} ${limpio.apellidos}`,
                        limpio.email,
                        limpio.pin,
                        employee.invite_code || inviteCode || ''
                    );
                }
                if (admin_email) {
                    void sendVerificationRequestEmail(
                        admin_email,
                        `${limpio.nombre} ${limpio.apellidos}`
                    );
                }

                return { success: true };
            },

            // Alta pública de administrador: queda pendiente de validar, sin sesión.
            createAdmin: async (firstName, lastName, pin, email = null, avatarUrl = null, companyName = null, fiscalId = null) => {
                set({ isLoading: true });
                const nombre = `${firstName.trim()} ${lastName.trim()}`;

                const r = await intentar(() =>
                    rpc<Employee & { admin_email?: string | null }>('register_admin', {
                        p_first_name: firstName.trim(),
                        p_last_name: lastName.trim(),
                        p_pin: pin.trim(),
                        p_email: email?.trim() || null,
                        p_avatar_url: avatarUrl,
                        p_company_name: companyName?.trim() || null,
                        p_fiscal_id: fiscalId?.trim() || null,
                    })
                );
                set({ isLoading: false });

                if (!r.success || !r.data) return { success: false, error: r.error };

                if (r.data.admin_email) {
                    void sendVerificationRequestEmail(r.data.admin_email, nombre);
                }

                return { success: true };
            },

            // Alta hecha por un administrador dentro de su propia organización.
            createUser: async (firstName, lastName, pin, email = null, avatarUrl = null) => {
                set({ isLoading: true });
                const limpio = {
                    nombre: firstName.trim(),
                    apellidos: lastName.trim(),
                    pin: pin.trim(),
                    email: email?.trim() || null,
                };

                const r = await intentar(() =>
                    rpc<Employee>('admin_create_user', {
                        p_token: get().token,
                        p_first_name: limpio.nombre,
                        p_last_name: limpio.apellidos,
                        p_pin: limpio.pin,
                        p_email: limpio.email,
                        p_avatar_url: avatarUrl,
                    })
                );
                set({ isLoading: false });

                if (!r.success || !r.data) return { success: false, error: r.error };

                if (limpio.email) {
                    void sendWelcomeEmail(
                        `${limpio.nombre} ${limpio.apellidos}`,
                        limpio.email,
                        limpio.pin,
                        r.data.invite_code || ''
                    );
                }

                return { success: true };
            },

            updateEmployee: async (id, data) => {
                const r = await intentar(() =>
                    rpc<Employee>('admin_update_employee', {
                        p_token: get().token,
                        p_id: id,
                        p_first_name: data.first_name ?? null,
                        p_last_name: data.last_name ?? null,
                        p_email: data.employee_email ?? null,
                        p_pin: data.pin_text ?? null,
                        p_company_name: data.company_name ?? null,
                        p_fiscal_id: data.fiscal_id ?? null,
                    })
                );

                // Si el admin se ha editado a sí mismo, refrescamos el estado local.
                const actual = get().employee;
                if (r.success && r.data && actual?.id === id) {
                    set({ employee: { ...actual, ...r.data } });
                }

                return { success: r.success, error: r.error };
            },

            verifyEmployee: async (id) => {
                const r = await intentar(() =>
                    rpc<Employee>('admin_verify_employee', { p_token: get().token, p_id: id })
                );
                return { success: r.success, error: r.error };
            },

            assignEmployee: async (id, adminId) => {
                const r = await intentar(() =>
                    rpc<Employee>('admin_assign_employee', {
                        p_token: get().token, p_id: id, p_admin_id: adminId,
                    })
                );
                return { success: r.success, error: r.error };
            },

            setRole: async (id, role) => {
                const r = await intentar(() =>
                    rpc<Employee>('admin_set_role', { p_token: get().token, p_id: id, p_role: role })
                );
                return { success: r.success, error: r.error };
            },

            deleteEmployee: async (id) => {
                const r = await intentar(() =>
                    rpc<void>('admin_delete_employee', { p_token: get().token, p_id: id })
                );
                return { success: r.success, error: r.error };
            },

            // Vuelve a leer el perfil por si un admin cambió el rol o la validación.
            regenerateInviteCode: async (id) => {
                const r = await intentar(() =>
                    rpc<Employee>('admin_regenerate_invite_code', { p_token: get().token, p_id: id })
                );
                return { success: r.success, error: r.error };
            },

            refreshMe: async () => {
                const token = get().token;
                if (!token) return;
                try {
                    const employee = await rpc<Employee>('get_me', { p_token: token });
                    set({ employee });
                } catch {
                    // rpc() ya habrá cerrado la sesión si el token murió.
                }
            },

            /**
             * Suplantación validada en servidor: el maestro pide un token nuevo
             * para el usuario destino. Antes esto solo cambiaba el estado local,
             * así que no demostraba nada ante la base de datos.
             */
            impersonate: async (targetId) => {
                const { employee, token, originalAdmin } = get();
                if (!employee || !token) return { success: false, error: 'No hay sesión activa.' };

                const r = await intentar(() =>
                    rpc<SesionRpc>('admin_impersonate', { p_token: token, p_target_id: targetId })
                );

                if (!r.success || !r.data) return { success: false, error: r.error };

                const { token: nuevoToken, ...destino } = r.data;
                set({
                    employee: destino,
                    token: nuevoToken,
                    isAuthenticated: true,
                    originalAdmin: originalAdmin ?? { employee, token },
                });
                return { success: true };
            },

            logout: async () => {
                const { token, originalAdmin } = get();

                if (token) {
                    // Invalidamos el token en el servidor; si falla, seguimos igual.
                    try { await rpc<void>('logout', { p_token: token }); } catch { /* ignorado */ }
                }

                if (originalAdmin) {
                    // Estábamos suplantando: volvemos a la sesión del maestro.
                    set({
                        employee: originalAdmin.employee,
                        token: originalAdmin.token,
                        isAuthenticated: true,
                        originalAdmin: null,
                    });
                    return;
                }

                get().clearSession();
            },
        }),
        {
            name: 'auth-storage',
            // v2 introduce el token de sesión. Cualquier sesión guardada por la
            // versión anterior no lo tiene, así que se descarta y el usuario
            // vuelve a entrar una sola vez tras el despliegue.
            version: 2,
            migrate: (persisted) => {
                const previo = persisted as Partial<AuthState> | undefined;
                const vacia = {
                    employee: null, token: null, isAuthenticated: false, originalAdmin: null,
                };
                if (!previo?.token || !previo.employee) return vacia;
                return {
                    employee: previo.employee,
                    token: previo.token,
                    isAuthenticated: true,
                    originalAdmin: previo.originalAdmin ?? null,
                };
            },
            partialize: (state) => ({
                employee: state.employee,
                token: state.token,
                originalAdmin: state.originalAdmin,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// Si el servidor rechaza el token, la sesión local se descarta al momento.
onSessionExpired(() => useAuthStore.getState().clearSession());
