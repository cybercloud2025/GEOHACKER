import { useState } from 'react';
import { Mail, X, RefreshCw, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';
import { sendWelcomeEmail } from '../lib/email';

export const EmailVerificationBanner = () => {
    const { employee } = useAuthStore();
    const [dismissed, setDismissed] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!employee || dismissed) return null;
    if (!employee.employee_email) return null;
    if ((employee as { email_verified?: boolean }).email_verified === true) return null;

    const handleSendVerification = async () => {
        if (!employee.id || !employee.employee_email) return;
        setSending(true);
        setError(null);

        try {
            const { data, error: rpcError } = await supabase.rpc('request_email_verification', {
                p_employee_id: employee.id
            });

            if (rpcError) throw rpcError;
            if (data?.error) throw new Error(data.message || data.error);

            const verifyUrl = `${window.location.origin}/verify-email?token=${data.token}`;
            await sendWelcomeEmail(
                `${employee.first_name} ${employee.last_name}`,
                employee.employee_email,
                'VERIFICA TU EMAIL',
                verifyUrl
            );

            setSent(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al enviar verificación';
            setError(msg);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-yellow-400 shrink-0" />
                <div className="text-sm">
                    {sent ? (
                        <span className="text-green-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Email de verificación enviado a {employee.employee_email}. Revisa tu bandeja.
                        </span>
                    ) : (
                        <span className="text-yellow-300">
                            Tu email <strong>{employee.employee_email}</strong> no está verificado.
                            {error && <span className="block text-red-400 mt-1">{error}</span>}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {!sent && (
                    <button
                        onClick={handleSendVerification}
                        disabled={sending}
                        className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs font-bold uppercase tracking-wider rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                        {sending ? 'Enviando...' : 'Verificar ahora'}
                    </button>
                )}
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1.5 text-yellow-400/60 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-md transition-colors"
                    aria-label="Cerrar"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
