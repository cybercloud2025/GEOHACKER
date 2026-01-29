import { useEffect, useState, useRef } from 'react';

const SNIPPETS = [
    "INICIANDO_PROTOCOLO_SEGURO...",
    "CONEXION_ESTABLECIDA: ENCRIPTADA",
    "EVADIENDO_FIREWALL_CAPA_7...",
    "TOKEN_ACCESO_GENERADO: 0x92F1A...",
    "ACCESO_ROOT: CONCEDIDO",
    "DESENCRIPTANDO_CLAVE_PRIMARIA...",
    "ESCANEA_PUERTOS: [22, 80, 443, 8080]",
    "INYECCION_SQL_DETECTADA: BLOQUEADA",
    "ANULANDO_POLITICAS_SEGURIDAD...",
    "CREANDO_TUNEL_VIRTUAL...",
    "PING 192.168.0.1 (0.2ms)",
    "CARGANDO_MODULO: AUTH_V2",
    "ADVERTENCIA_SISTEMA: IP_NO_REGISTRADA",
    "EJECUTANDO_PAYLOAD...",
    "VOLCADO_MEMORIA_COMPLETO",
    "DESBORDAMIENTO_BUFFER_EVITADO",
    "SUBIENDO_SHELL... 100%",
    "ROMPIENDO_ENCRIPTACION_WFA...",
    "CIERRE_SESION: FALLIDO",
    "INYECCION_DLL: EXITO",
    "SHELL_REMOTO_ABIERTO",
    "EXTRAYENDO_VOLCADO_BASE_DATOS...",
    "BORRANDO_REGISTROS... HECHO",
    "EVADIENDO_BIOMETRICOS...",
    "SUBIENDO_PUERTA_TRASERA_V3...",
    "OVERCLOCKING_CPU... 150%"
];

interface TypingStream {
    id: number;
    text: string;
    fullText: string;
    x: number;
    y: number;
    isCompleted: boolean;
    color: string;
}


const COLORS = [
    'text-[#39FF14]', // Neon Green
    'text-blue-400',   // Cyber Blue
    'text-red-400',    // Alert Red
    'text-yellow-400', // Warning Yellow
    'text-purple-400', // Matrix Purple
    'text-pink-400'    // Synth Pink
];

export const TerminalCodeEffect = () => {
    const [streams, setStreams] = useState<TypingStream[]>([]);
    const nextId = useRef(0);

    useEffect(() => {
        const spawnStream = () => {
            const snippet = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)];
            const newStream: TypingStream = {
                id: nextId.current++,
                text: "",
                fullText: snippet,
                x: Math.random() * 85,
                y: Math.random() * 92,
                isCompleted: false,
                color: COLORS[Math.floor(Math.random() * COLORS.length)]
            };
            setStreams(prev => [...prev, newStream].slice(-15));
        };

        const spawnInterval = setInterval(spawnStream, 2000); // Slower spawning
        spawnStream();
        return () => clearInterval(spawnInterval);
    }, []);

    useEffect(() => {
        const typeInterval = setInterval(() => {
            setStreams(prev => prev.map(s => {
                if (s.text.length < s.fullText.length) {
                    return { ...s, text: s.fullText.slice(0, s.text.length + 1) };
                }
                return { ...s, isCompleted: true };
            }));
        }, 120); // Slower typing speed
        return () => clearInterval(typeInterval);
    }, []);

    return (
        <div className="absolute inset-0 z-0 bg-black overflow-hidden pointer-events-none select-none font-mono">
            <div className="w-full h-full absolute inset-0 bg-black" />

            {/* CORNER GLITCHES */}
            <CornerGlitch position="top-4 left-4" color="#ef4444" /> {/* Red */}
            <CornerGlitch position="top-4 right-4" color="#3b82f6" /> {/* Blue */}
            <CornerGlitch position="bottom-4 left-4" color="#eab308" /> {/* Yellow */}
            <CornerGlitch position="bottom-4 right-4" color="#39FF14" /> {/* Green */}

            <div className="relative z-10 w-full h-full">
                {streams.map((stream) => (
                    <div
                        key={stream.id}
                        className="absolute whitespace-nowrap transition-opacity duration-500"
                        style={{
                            left: `${stream.x}%`,
                            top: `${stream.y}%`,
                            opacity: stream.isCompleted ? 0.2 : 0.8
                        }}
                    >
                        <div className="flex items-center gap-1">
                            <span className={`text-xs md:text-sm font-bold ${stream.color} drop-shadow-[0_0_5px_currentColor]`}>
                                {`> ${stream.text}`}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.05),rgba(0,255,0,0.02),rgba(0,0,255,0.05))] z-20 bg-[length:100%_4px,5px_100%] opacity-40" />
            <div className="absolute inset-0 z-30 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.8)_100%)] shadow-[inset_0_0_100px_rgba(0,0,0,0.7)]" />
        </div>
    );
};

const CornerGlitch = ({ position, color }: { position: string, color: string }) => {
    const [text, setText] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setText(Math.random().toString(16).slice(2, 10).toUpperCase());
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`absolute ${position} z-10 font-mono text-xs md:text-lg font-black opacity-60 animate-pulse`} style={{ color, textShadow: `0 0 10px ${color}` }}>
            {`0x${text}`}
        </div>
    );
};
