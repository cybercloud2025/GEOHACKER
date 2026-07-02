import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase, setSupabaseAccessToken } from '../lib/supabase';
import { sendWelcomeEmail, sendVerificationRequestEmail } from '../lib/email';

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

interface Employee {
    id: string;
    first_name: string;
    last_name: string;
    employee_email?: string | null;
    avatar_url?: string | null;
    role: string;
    admin_id?: string;
    invite_code?: string;
    verified?: boolean;
}

interface PendingTwoFactor {
    employee: Employee;
    secret: string;
    token: string;
}

interface AuthState {
    employee: Employee | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRegistrationEnabled: boolean;
    sessionStartedAt: number | null;
    pending2FA: PendingTwoFactor | null;
    complete2FALogin: () => void;
    cancel2FALogin: () => void;
    fetchSettings: () => Promise<void>;
    toggleRegistration: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string; requires2FA?: boolean }>;
    register: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null, inviteCode?: string | null) => Promise<{ success: boolean; error?: string }>;
    createAdmin: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null, companyName?: string | null, fiscalId?: string | null) => Promise<{ success: boolean; error?: string }>;
    createUser: (firstName: string, lastName: string, pin: string, inviteCode: string, email?: string | null, avatarUrl?: string | null) => Promise<{ success: boolean; error?: string }>;
    updateEmployee: (id: string, data: Partial<{ first_name: string; last_name: string; employee_email: string | null; pin_text: string; role: string; verified: boolean; admin_id: string; invite_code: string; company_name: string | null; fiscal_id: string | null }>) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    setEmployee: (employee: Employee | null) => void;
    originalAdmin: Employee | null; // For impersonation
    impersonate: (targetEmployee: Employee) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            employee: null,
            token: null,
            originalAdmin: null,
            isAuthenticated: false,
            isLoading: false,
            isRegistrationEnabled: true,
            sessionStartedAt: null,
            pending2FA: null,

            fetchSettings: async () => {
                try {
                    const { data, error } = await supabase
                        .rpc('get_system_setting', { p_key: 'registrations_enabled' });
                    if (error) throw error;
                    if (data !== null && data !== undefined) {
                        set({ isRegistrationEnabled: data as boolean });
                    }
                } catch (err) {
                    console.error('Error fetching settings:', err);
                }
            },

            toggleRegistration: async (enabled: boolean) => {
                try {
                    const actor = get().employee?.id || null;
                    const { error } = await supabase
                        .rpc('set_system_setting', {
                            p_key: 'registrations_enabled',
                            p_value: enabled,
                            p_actor_id: actor
                        });
                    if (error) throw error;
                    set({ isRegistrationEnabled: enabled });
                    return { success: true };
                } catch (err: any) {
                    console.error('Error toggling registration:', err);
                    return { success: false, error: err.message };
                }
            },

            loginWithPin: async (pin: string) => {
                set({ isLoading: true });
                try {
                    // The auth-login edge function verifies the PIN (bcrypt + IP
                    // rate limiting, IP derived server-side) and returns a signed
                    // JWT plus the employee record.
                    const { data, error } = await supabase.functions.invoke('auth-login', {
                        body: { pin }
                    });

                    if (error) {
                        let msg = 'PIN incorrecto';
                        try {
                            const ctx: any = (error as any).context;
                            const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
                            if (body?.error === 'rate_limited') {
                                msg = body.message || 'Demasiados intentos fallidos. Espera 15 minutos.';
                            }
                        } catch { /* ignore body parse errors */ }
                        set({ isLoading: false });
                        return { success: false, error: msg };
                    }

                    const token = (data as any)?.token as string | undefined;
                    const emp = (data as any)?.employee as Employee | undefined;
                    if (!token || !emp) {
                        set({ isLoading: false });
                        return { success: false, error: 'Usuario no registrado' };
                    }

                    if (emp.role === 'admin' && !emp.verified && emp.invite_code !== 'CORP-18EC') {
                        set({ isLoading: false });
                        return { success: false, error: 'Tu cuenta de administrador está pendiente de validación por el Administrador Maestro.' };
                    }

                    const { data: twoFa } = await supabase.rpc('get_2fa_status', { p_employee_id: emp.id });
                    if (twoFa?.configured && twoFa?.enabled) {
                        set({
                            pending2FA: { employee: emp, secret: twoFa.secret_b32, token },
                            isLoading: false
                        });
                        return { success: true, requires2FA: true };
                    }

                    setSupabaseAccessToken(token);
                    set({
                        employee: emp,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                        originalAdmin: null,
                        sessionStartedAt: Date.now()
                    });
                    return { success: true };
                } catch (error: any) {
                    console.error('Login error:', error);
                    set({ isLoading: false });
                    const msg = error.message || 'Error desconocido';
                    return { success: false, error: msg };
                }
            },

            complete2FALogin: () => {
                const pending = get().pending2FA;
                if (!pending) return;
                setSupabaseAccessToken(pending.token);
                set({
                    employee: pending.employee,
                    token: pending.token,
                    isAuthenticated: true,
                    pending2FA: null,
                    originalAdmin: null,
                    sessionStartedAt: Date.now()
                });
            },

            cancel2FALogin: () => {
                set({ pending2FA: null });
            },

            register: async (firstName: string, lastName: string, pin: string, email: string | null = null, avatarUrl: string | null = null, inviteCode: string | null = null) => {
                set({ isLoading: true });
                try {
                    const cleanFirstName = firstName.trim();
                    const cleanLastName = lastName.trim();
                    const cleanPin = pin.trim();
                    const cleanEmail = email?.trim() || null;

                    const currentEmployee = get().employee;
                    const isAdminAction = !!currentEmployee;

                    // Use the new RPC to register with code
                    const { data, error } = await supabase
                        .rpc('register_employee_with_code', {
                            p_first_name: cleanFirstName,
                            p_last_name: cleanLastName,
                            p_pin: cleanPin,
                            p_email: cleanEmail,
                            p_avatar_url: avatarUrl,
                            p_invite_code: inviteCode,
                            p_verified: isAdminAction // If admin is creating it, it's verified
                        });

                    if (error) throw error;

                    // Send Welcome Email if email is provided
                    if (cleanEmail && data) {
                        // Don't await this to keep UI snappy
                        const empData = data as Employee;
                        sendWelcomeEmail(
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanEmail,
                            cleanPin,
                            empData.invite_code || inviteCode || 'CORP-????'
                        );
                    }

                    // CHECK: If registration returned an admin_email, it means we must notify the admin
                    if (data && (data as any).admin_email) {
                        sendVerificationRequestEmail(
                            (data as any).admin_email,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    // If we are logged in (admin creating user), we don't want to replace the current session with the new user's session
                    // But if we are not logged in (public register), we usually auto-login.
                    if (!currentEmployee) {
                        // Public self-registration: auto-login via the edge function
                        // so the new user gets a real JWT session (not just data).
                        await get().loginWithPin(cleanPin);
                    } else {
                        // Admin creating user: don't log in as the new user.
                        set({ isLoading: false });
                    }

                    return { success: true };
                } catch (error: any) {
                    console.error('Registration error:', error);
                    set({ isLoading: false });
                    const msg = error.message || 'Error al registrar usuario';
                    return { success: false, error: msg };
                }
            },

            createAdmin: async (firstName: string, lastName: string, pin: string, email: string | null = null, avatarUrl: string | null = null, companyName: string | null = null, fiscalId: string | null = null) => {
                set({ isLoading: true });
                try {
                    const cleanFirstName = firstName.trim();
                    const cleanLastName = lastName.trim();
                    const cleanPin = pin.trim();
                    const cleanEmail = email?.trim() || null;
                    const cleanCompanyName = companyName?.trim() || null;
                    const cleanFiscalId = fiscalId?.trim() || null;

                    const { data, error } = await supabase
                        .rpc('register_employee_with_code', {
                            p_first_name: cleanFirstName,
                            p_last_name: cleanLastName,
                            p_pin: cleanPin,
                            p_email: cleanEmail,
                            p_avatar_url: avatarUrl,
                            p_invite_code: 'NEW',
                            p_verified: false,
                            p_company_name: cleanCompanyName,
                            p_fiscal_id: cleanFiscalId
                        });

                    if (error) throw error;

                    // CHECK: If registration returned an admin_email, it means we must notify the Master Admin
                    if (data && (data as any).admin_email) {
                        sendVerificationRequestEmail(
                            (data as any).admin_email,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    set({ isLoading: false });
                    return { success: true };
                } catch (error: any) {
                    console.error('Create Admin error:', error);
                    set({ isLoading: false });
                    const msg = error.message || 'Error al crear administrador';
                    return { success: false, error: msg };
                }
            },

            createUser: async (firstName: string, lastName: string, pin: string, inviteCode: string, email: string | null = null, avatarUrl: string | null = null) => {
                set({ isLoading: true });
                try {
                    const cleanFirstName = firstName.trim();
                    const cleanLastName = lastName.trim();
                    const cleanPin = pin.trim();
                    const cleanEmail = email?.trim() || null;

                    const { data, error } = await supabase
                        .rpc('register_employee_with_code', {
                            p_first_name: cleanFirstName,
                            p_last_name: cleanLastName,
                            p_pin: cleanPin,
                            p_email: cleanEmail,
                            p_avatar_url: avatarUrl,
                            p_invite_code: inviteCode,
                            p_verified: true // Users created by admins are verified
                        });

                    if (error) throw error;

                    // CHECK: If registration returned an admin_email, it means we must notify the admin
                    if (data && (data as any).admin_email) {
                        sendVerificationRequestEmail(
                            (data as any).admin_email,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    // Send Welcome Email
                    if (cleanEmail && data) {
                        sendWelcomeEmail(
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanEmail,
                            cleanPin,
                            (data as Employee).invite_code || inviteCode
                        );
                    }

                    set({ isLoading: false });
                    return { success: true };
                } catch (error: any) {
                    console.error('Create User error:', error);
                    set({ isLoading: false });
                    const msg = error.message || 'Error al crear usuario';
                    return { success: false, error: msg };
                }
            },

            updateEmployee: async (id: string, updateData: any) => {
                set({ isLoading: true });
                try {
                    const actor = get().employee?.id || null;
                    const { error } = await supabase
                        .rpc('update_employee_safe', {
                            p_user_id: id,
                            p_data: updateData,
                            p_actor_id: actor
                        });

                    if (error) throw error;

                    const currentEmployee = get().employee;
                    if (currentEmployee && currentEmployee.id === id) {
                        set({ employee: { ...currentEmployee, ...updateData } });
                    }

                    set({ isLoading: false });
                    return { success: true };
                } catch (error: any) {
                    console.error('Update employee error:', error);
                    set({ isLoading: false });
                    return { success: false, error: error.message };
                }
            },

            logout: () => {
                const { originalAdmin } = get();
                if (originalAdmin) {
                    // Exiting impersonation: keep the admin's JWT session.
                    set({
                        employee: originalAdmin,
                        originalAdmin: null,
                        isAuthenticated: true,
                        sessionStartedAt: Date.now()
                    });
                } else {
                    setSupabaseAccessToken(null);
                    set({
                        employee: null,
                        token: null,
                        isAuthenticated: false,
                        originalAdmin: null,
                        sessionStartedAt: null
                    });
                }
            },

            setEmployee: (employee: Employee | null) => set({ employee, isAuthenticated: !!employee }),

            impersonate: (targetEmployee: Employee) => {
                const currentEmployee = get().employee;
                if (!currentEmployee) return;

                const originalAdmin = get().originalAdmin || currentEmployee;

                set({
                    employee: targetEmployee,
                    originalAdmin: originalAdmin,
                    isAuthenticated: true
                });
            }
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                const started = state.sessionStartedAt;
                if (started && Date.now() - started > SESSION_MAX_AGE_MS) {
                    state.employee = null;
                    state.token = null;
                    state.isAuthenticated = false;
                    state.originalAdmin = null;
                    state.sessionStartedAt = null;
                    setSupabaseAccessToken(null);
                    console.warn('Sesión expirada (>8h). Login requerido.');
                } else if (state.token) {
                    // Restore the JWT into the Supabase client so persisted
                    // sessions stay authenticated across reloads.
                    setSupabaseAccessToken(state.token);
                }
            }
        }
    )
);
