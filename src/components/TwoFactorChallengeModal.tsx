import { useState } from 'react';
import { authenticator } from 'otplib';
import { ShieldCheck, AlertTriangle, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
    employeeId: string;
    secret: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const TwoFactorChallengeModal = ({ employeeId, secret, onSuccess, onCancel }: Props) => {
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'totp' | 'backup'>('totp');

    const handleVerify = async () => {
        setLoading(true);
        setError(null);
        try {
            const trimmed = code.trim();
            if (!trimmed) throw new Error('Introduce un código');

            if (mode === 'totp') {
                const isValid = authenticator.verify({ token: trimmed, secret });
                if (!isValid) throw new Error('Código incorrecto');
            } else {
                const { data, error: rpcError } = await supabase.rpc('verify_backup_code', {
                    p_employee_id: employeeId,
                    p_code: trimmed
                });
                if (rpcError) throw rpcError;
                if (data !== true) throw new Error('Código de respaldo inválido');
            }

            await supabase.rpc('mark_2fa_used', { p_employee_id: employeeId });
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error verificando 2FA');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-cyan-500/40 rounded-xl max-w-sm w-full shadow-2xl shadow-cyan-500/20">
                <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-base font-bold text-cyan-400 tracking-wider uppercase">
                        Verificación 2FA
                    </h2>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <p className="text-sm text-zinc-300">
                        {mode === 'totp'
                            ? 'Introduce el código de 6 dígitos de tu app autenticadora.'
                            : 'Introduce uno de tus códigos de respaldo de 8 dígitos.'}
                    </p>

                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={mode === 'totp' ? 6 : 8}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
                        className="w-full bg-black/40 border border-cyan-500/40 rounded px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                        placeholder={mode === 'totp' ? '000000' : '00000000'}
                        autoFocus
                    />

                    <div className="flex gap-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/20 text-white text-sm rounded hover:bg-white/10"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={loading || code.length < (mode === 'totp' ? 6 : 8)}
                            className="flex-1 px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-bold uppercase tracking-wider rounded hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                            {loading ? 'Verificando...' : 'Verificar'}
                        </button>
                    </div>

                    <button
                        onClick={() => { setMode(mode === 'totp' ? 'backup' : 'totp'); setCode(''); setError(null); }}
                        className="w-full text-xs text-cyan-400/70 hover:text-cyan-400 flex items-center justify-center gap-1"
                    >
                        <KeyRound className="w-3 h-3" />
                        {mode === 'totp' ? 'Usar código de respaldo' : 'Usar código de la app'}
                    </button>
                </div>
            </div>
        </div>
    );
};
