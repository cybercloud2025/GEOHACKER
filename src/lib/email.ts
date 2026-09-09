import emailjs from '@emailjs/browser';
import { getConfig } from './config';

/**
 * Avisos por correo vía EmailJS.
 *
 * La configuración se lee en cada envío (no al cargar el módulo) para que valga
 * la que el usuario haya guardado en /configuracion. Si falta, no se envía
 * nada: es una funcionalidad opcional y su ausencia no rompe ningún flujo.
 */

const credenciales = () => {
    const c = getConfig();
    return {
        servicio: c.emailjsServiceId,
        plantillaBienvenida: c.emailjsTemplateWelcomeId,
        plantillaReset: c.emailjsTemplateResetId,
        clavePublica: c.emailjsPublicKey,
    };
};

export const sendWelcomeEmail = async (
    employeeName: string,
    employeeEmail: string,
    pin: string,
    companyCode: string
): Promise<boolean> => {
    const { servicio, plantillaBienvenida, clavePublica } = credenciales();

    if (!servicio || !plantillaBienvenida || !clavePublica) {
        console.warn('EmailJS sin configurar. No se envía el correo de bienvenida.');
        return false;
    }

    try {
        await emailjs.send(
            servicio,
            plantillaBienvenida,
            {
                to_name: employeeName,
                to_email: employeeEmail,
                pin_code: pin,
                company_code: companyCode,
                login_url: window.location.origin,
            },
            clavePublica
        );
        return true;
    } catch (error) {
        console.error('No se pudo enviar el correo de bienvenida:', error);
        return false;
    }
};

/**
 * Avisa al administrador de que hay un alta pendiente de validar.
 * No incluye el PIN: es la credencial de otra persona y no debe viajar
 * por correo hacia un tercero.
 */
export const sendVerificationRequestEmail = async (
    adminEmail: string,
    newUserName: string
): Promise<boolean> => {
    const { servicio, plantillaBienvenida, clavePublica } = credenciales();

    if (!servicio || !plantillaBienvenida || !clavePublica) return false;

    try {
        await emailjs.send(
            servicio,
            plantillaBienvenida,
            {
                to_name: 'Administrador',
                to_email: adminEmail,
                company_code: `NUEVO USUARIO: ${newUserName}`,
                pin_code: '',
                login_url: `${window.location.origin}/admin`,
                message: 'Un nuevo usuario se ha registrado y requiere confirmación.',
            },
            clavePublica
        );
        return true;
    } catch (error) {
        console.error('No se pudo enviar el aviso de validación:', error);
        return false;
    }
};

export const sendResetPasswordEmail = async (
    userEmail: string,
    userName: string,
    resetUrl: string
): Promise<boolean> => {
    const { servicio, plantillaReset, clavePublica } = credenciales();

    if (!servicio || !plantillaReset || !clavePublica) {
        console.warn('EmailJS sin plantilla de recuperación configurada.');
        return false;
    }

    try {
        await emailjs.send(
            servicio,
            plantillaReset,
            {
                to_name: userName,
                to_email: userEmail,
                reset_url: resetUrl,
                origin_ip: 'Solicitado vía Web',
                device_info: navigator.userAgent,
            },
            clavePublica
        );
        return true;
    } catch (error) {
        console.error('No se pudo enviar el correo de recuperación:', error);
        return false;
    }
};
