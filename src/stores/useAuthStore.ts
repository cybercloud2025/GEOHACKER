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

interface AuthState {
    employee: Employee | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isRegistrationEnabled: boolean;
    fetchSettings: () => Promise<void>;
    toggleRegistration: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
    loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
    register: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null, inviteCode?: string | null) => Promise<{ success: boolean; error?: string }>;
    createAdmin: (firstName: string, lastName: string, pin: string, email?: string | null, avatarUrl?: string | null) => Promise<{ success: boolean; error?: string }>;
    createUser: (firstName: string, lastName: string, pin: string, inviteCode: string, email?: string | null, avatarUrl?: string | null) => Promise<{ success: boolean; error?: string }>;
    updateEmployee: (id: string, data: Partial<{ first_name: string; last_name: string; employee_email: string | null; pin_text: string; role: string; verified: boolean; admin_id: string; invite_code: string }>) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    setEmployee: (employee: Employee | null) => void;
    originalAdmin: Employee | null; // For impersonation
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
                    const { error } = await supabase
                        .from('system_settings')
                        .update({ value: enabled, updated_at: new Date().toISOString() })
                        .eq('key', 'registrations_enabled');
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
                    // RPC call finds user with that PIN hash.
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
                            originalAdmin: null // Clear any impersonation on fresh login
                        });
                        return { success: true };
                    }
                    throw new Error('Usuario no registrado');
                } catch (error: any) {
                    console.error('Login error:', error);
                    set({ isLoading: false });
                    const msg = error.message || 'Error desconocido';
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
                        set({
                            employee: data as Employee,
                            isAuthenticated: true,
                            isLoading: false
                        });
                    } else {
                        // Admin creating user: Don't log in as the new user, just return success
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

            createAdmin: async (firstName: string, lastName: string, pin: string, email: string | null = null, avatarUrl: string | null = null) => {
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
                            p_invite_code: 'NEW',
                            p_verified: false // New normal admins must be validated by Master Admin
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
                    const { error } = await supabase
                        .from('employees')
                        .update(updateData)
                        .eq('id', id);

                    if (error) throw error;

                    // If we updated our own data, refresh the local state
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
