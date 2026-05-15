import { useEffect, useState } from 'react';
import { authenticator } from '@otplib/preset-browser';
import QRCode from 'qrcode';
import { ShieldCheck, X, Copy, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/useAuthStore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'intro' | 'qr' | 'verify' | 'backup' | 'done';

export const TwoFactorSetupModal = ({ isOpen, onClose }: Props) => {
    const { employee } = useAuthStore();
    const [step, setStep] = useState<Step>('intro');
    const [secret, setSecret] = useState<string>('');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [code, setCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setStep('intro');
            setSecret('');
            setQrDataUrl('');
            setCode('');
            setBackupCodes([]);
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen || !employee) return null;

    const handleStart = async () => {
        setLoading(true);
        setError(null);
        try {
            const newSecret = authenticator.generateSecret();
            setSecret(newSecret);

            const label = `${employee.first_name} ${employee.last_name}`;
            const issuer = 'Geohacker';
            const uri = authenticator.keyuri(label, issuer, newSecret);
            const dataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 2 });
            setQrDataUrl(dataUrl);

            const { error: rpcError } = await supabase.rpc('setup_2fa', {
                p_employee_id: employee.id,
                p_secret_b32: newSecret
            });
            if (rpcError) throw rpcError;

            setStep('qr');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al generar 2FA');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!secret) throw new Error('Secret no generado');
            const isValid = authenticator.verify({ token: code.trim(), secret });
            if (!isValid) throw new Error('Código incorrecto. Verifica que tu app esté sincronizada.');

            const { data, error: rpcError } = await supabase.rpc('enable_2fa', {
                p_employee_id: employee.id
            });
            if (rpcError) throw rpcError;

            setBackupCodes(data?.backup_codes || []);
            setStep('backup');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al verificar');
        } finally {
            setLoading(false);
        }
    };

    const copyAll = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-cyan-500/40 rounded-xl max-w-md w-full shadow-2xl shadow-cyan-500/20">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2 tracking-wider uppercase">
                        <ShieldCheck className="w-5 h-5" />
                        Activar 2FA
                    </h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm p-3 rounded flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'intro' && (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-300">
                                La autenticación de dos factores añade una capa extra de seguridad: tras tu PIN,
                                pedirá un código de 6 dígitos de tu app autenticadora (Google Authenticator, Authy, 1Password).
                            </p>
                            <p className="text-xs text-zinc-500">
                                Vas a necesitar instalar una app de autenticación si no la tienes ya. La configuración tarda 1 minuto.
                            </p>
                            <button
                                onClick={handleStart}
                                disabled={loading}
                                className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-bold uppercase tracking-wider rounded hover:bg-cyan-500/30 disabled:opacity-50"
                            >
                                {loading ? 'Generando...' : 'Comenzar configuración'}
                            </button>
                        </div>
                    )}

                    {step === 'qr' && (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-300">
                                Escanea este QR con tu app autenticadora:
                            </p>
                            {qrDataUrl && (
                                <div className="bg-white p-3 rounded-lg flex justify-center">
                                    <img src={qrDataUrl} alt="QR 2FA" />
                                </div>
                            )}
                            <details className="text-xs text-zinc-500">
                                <summary className="cursor-pointer hover:text-zinc-300">¿No puedes escanear? Introduce manualmente:</summary>
                                <code className="block mt-2 bg-black/40 p-2 rounded text-cyan-400 break-all">{secret}</code>
                            </details>
                            <button
                                onClick={() => setStep('verify')}
                                className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-bold uppercase tracking-wider rounded hover:bg-cyan-500/30"
                            >
                                Ya lo añadí
                            </button>
                        </div>
                    )}

                    {step === 'verify' && (
                        <div className="space-y-4">
                            <p className="text-sm text-zinc-300">
                                Introduce el código de 6 dígitos que muestra tu app:
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                className="w-full bg-black/40 border border-cyan-500/40 rounded px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                                placeholder="000000"
                                autoFocus
                            />
                            <button
                                onClick={handleVerify}
                                disabled={loading || code.length !== 6}
                                className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-bold uppercase tracking-wider rounded hover:bg-cyan-500/30 disabled:opacity-50"
                            >
                                {loading ? 'Verificando...' : 'Verificar y activar'}
                            </button>
                        </div>
                    )}

                    {step === 'backup' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 text-sm p-3 rounded">
                                <strong>⚠️ Guarda estos códigos de respaldo.</strong> Solo se mostrarán una vez.
                                Sirven para acceder si pierdes tu app autenticadora.
                            </div>
                            <div className="bg-black/40 border border-white/10 rounded p-4 font-mono text-sm space-y-1">
                                {backupCodes.map((bc, i) => (
                                    <div key={i} className="text-cyan-300">{bc}</div>
                                ))}
                            </div>
                            <button
                                onClick={copyAll}
                                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white text-sm rounded hover:bg-white/10 flex items-center justify-center gap-2"
                            >
                                <Copy className="w-4 h-4" />
                                Copiar todos
                            </button>
                            <button
                                onClick={() => setStep('done')}
                                className="w-full px-4 py-2 bg-green-500/20 border border-green-500 text-green-300 font-bold uppercase tracking-wider rounded hover:bg-green-500/30"
                            >
                                Los he guardado
                            </button>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="space-y-4 text-center">
                            <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                            <h3 className="text-xl font-bold text-green-400 tracking-wider uppercase">
                                2FA Activado
                            </h3>
                            <p className="text-sm text-zinc-300">
                                A partir del próximo inicio de sesión, te pediremos el código de tu app autenticadora.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500 text-cyan-300 font-bold uppercase tracking-wider rounded hover:bg-cyan-500/30"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
