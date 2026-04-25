import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { sendWelcomeEmail, sendVerificationRequestEmail } from '../lib/email';

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

interface RpcRegisterResult extends Employee {
    admin_email?: string;
}

interface AuthState {
    employee: Employee | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRegistrationEnabled: boolean;
    fetchSettings: () => Promise<void>;
    toggleRegistration: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
    register: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null, inviteCode?: string | null) => Promise<{ success: boolean; error?: string }>;
    createAdmin: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null, companyName?: string | null, fiscalId?: string | null) => Promise<{ success: boolean; error?: string }>;
    createUser: (firstName: string, lastName: string, pin: string, inviteCode: string, email?: string | null, avatarUrl?: string | null) => Promise<{ success: boolean; error?: string }>;
    updateEmployee: (id: string, data: Partial<{ first_name: string; last_name: string; employee_email: string | null; pin_text: string; role: string; verified: boolean; admin_id: string; invite_code: string; company_name: string | null; fiscal_id: string | null }>) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    setEmployee: (employee: Employee | null) => void;
    originalAdmin: Employee | null; // Para impersonación
    impersonate: (targetEmployee: Employee) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            employee: null,
            originalAdmin: null,
            isAuthenticated: false,
            isLoading: false,
            isRegistrationEnabled: true,

            fetchSettings: async () => {
                try {
                    const { data, error } = await supabase
                        .from('system_settings')
                        .select('value')
                        .eq('key', 'registrations_enabled')
                        .single();
                    if (error) throw error;
                    if (data) {
                        set({ isRegistrationEnabled: data.value as boolean });
                    }
                } catch (err) {
                    console.error('Error fetching settings:', err);
                }
            },

            toggleRegistration: async (enabled: boolean) => {
                try {
                    const callerId = get().employee?.id;
                    if (!callerId) throw new Error('No autenticado');
                    const { error } = await supabase.rpc('toggle_system_setting', {
                        p_caller_id: callerId,
                        p_key: 'registrations_enabled',
                        p_value: enabled
                    });
                    if (error) throw error;
                    set({ isRegistrationEnabled: enabled });
                    return { success: true };
                } catch (err: unknown) {
                    console.error('Error toggling registration:', err);
                    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
                }
            },

            loginWithPin: async (pin: string) => {
                set({ isLoading: true });
                try {
                    // La llamada RPC encuentra al usuario con ese hash de PIN.
                    const { data: employeeData } = await supabase
                        .rpc('login_with_pin', { p_pin: pin });

                    if (employeeData) {
                        const emp = employeeData as Employee;
                        // Special check: If it's an admin (non-Master), check if verified
                        if (emp.role === 'admin' && !emp.verified && emp.invite_code !== 'CORP-18EC') {
                            throw new Error('Tu cuenta de administrador está pendiente de validación por el Administrador Maestro.');
                        }

                        set({
                            employee: emp,
                            isAuthenticated: true,
                            isLoading: false,
                            originalAdmin: null // Limpiar cualquier impersonación en un login fresco
                        });
                        return { success: true };
                    }
                    throw new Error('Usuario no registrado');
                } catch (error: unknown) {
                    console.error('Login error:', error);
                    set({ isLoading: false });
                    const msg = error instanceof Error ? error.message : 'Error desconocido';
                    return { success: false, error: msg };
                }
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

                    // Usar el nuevo RPC para registrar con código
                    const { data, error } = await supabase
                        .rpc('register_employee_with_code', {
                            p_first_name: cleanFirstName,
                            p_last_name: cleanLastName,
                            p_pin: cleanPin,
                            p_email: cleanEmail,
                            p_avatar_url: avatarUrl,
                            p_invite_code: inviteCode,
                            p_verified: isAdminAction // Si un admin lo está creando, ya está verificado
                        });

                    if (error) throw error;

                    // Enviar Email de Bienvenida si se proporciona el correo
                    if (cleanEmail && data) {
                        // No esperar esto para mantener la UI ágil
                        const empData = data as Employee;
                        sendWelcomeEmail(
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanEmail,
                            cleanPin,
                            empData.invite_code || inviteCode || 'CORP-????'
                        );
                    }

                    // CHECK: If registration returned an admin_email, it means we must notify the admin
                    if (data && (data as RpcRegisterResult).admin_email) {
                        sendVerificationRequestEmail(
                            (data as RpcRegisterResult).admin_email!,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    // Si estamos logueados (admin creando usuario), no queremos reemplazar la sesión actual con la del nuevo usuario
                    // Pero si no estamos logueados (registro público), usualmente hacemos login automático.
                    if (!currentEmployee) {
                        set({
                            employee: data as Employee,
                            isAuthenticated: true,
                            isLoading: false
                        });
                    } else {
                        // Admin creando usuario: No loguear como el nuevo usuario, solo devolver éxito
                        set({ isLoading: false });
                    }

                    return { success: true };
                } catch (error: unknown) {
                    console.error('Registration error:', error);
                    set({ isLoading: false });
                    const msg = error instanceof Error ? error.message : 'Error al registrar usuario';
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

                    // VERIFICACIÓN: Si el registro devolvió un admin_email, significa que debemos notificar al Administrador Maestro
                    if (data && (data as RpcRegisterResult).admin_email) {
                        sendVerificationRequestEmail(
                            (data as RpcRegisterResult).admin_email!,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    set({ isLoading: false });
                    return { success: true };
                } catch (error: unknown) {
                    console.error('Create Admin error:', error);
                    set({ isLoading: false });
                    const msg = error instanceof Error ? error.message : 'Error al crear administrador';
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
                            p_verified: true // Los usuarios creados por admins están verificados
                        });

                    if (error) throw error;

                    // VERIFICACIÓN: Si el registro devolvió un admin_email, significa que debemos notificar al administrador
                    if (data && (data as RpcRegisterResult).admin_email) {
                        sendVerificationRequestEmail(
                            (data as RpcRegisterResult).admin_email!,
                            `${cleanFirstName} ${cleanLastName}`,
                            cleanPin
                        );
                    }

                    // Enviar Email de Bienvenida
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
                } catch (error: unknown) {
                    console.error('Create User error:', error);
                    set({ isLoading: false });
                    const msg = error instanceof Error ? error.message : 'Error al crear usuario';
                    return { success: false, error: msg };
                }
            },

            updateEmployee: async (id: string, updateData: Partial<{ first_name: string; last_name: string; employee_email: string | null; pin_text: string; role: string; verified: boolean; admin_id: string; invite_code: string; company_name: string | null; fiscal_id: string | null }>) => {
                set({ isLoading: true });
                try {
                    const callerId = get().originalAdmin?.id || get().employee?.id;
                    if (!callerId) throw new Error('No autenticado');
                    const { error } = await supabase.rpc('update_employee_data', {
                        p_caller_id: callerId,
                        p_target_id: id,
                        p_data: updateData as Record<string, unknown>
                    });

                    if (error) throw error;

                    // Si actualizamos nuestros propios datos, refrescar el estado local
                    const currentEmployee = get().employee;
                    if (currentEmployee && currentEmployee.id === id) {
                        set({ employee: { ...currentEmployee, ...updateData } });
                    }

                    set({ isLoading: false });
                    return { success: true };
                } catch (error: unknown) {
                    console.error('Update employee error:', error);
                    set({ isLoading: false });
                    return { success: false, error: error instanceof Error ? error.message : 'Error al actualizar' };
                }
            },

            logout: () => {
                const { originalAdmin } = get();
                if (originalAdmin) {
                    // Si estamos impersonando, volvemos al maestro
                    set({
                        employee: originalAdmin,
                        originalAdmin: null,
                        isAuthenticated: true
                    });
                } else {
                    // Si es el real, cerramos sesión completa
                    set({ employee: null, isAuthenticated: false, originalAdmin: null });
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
        }
    )
);
