import emailjs from '@emailjs/browser';

// Service configuration from environment variables
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_WELCOME_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME_ID;
const TEMPLATE_RESET_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_RESET_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const sendWelcomeEmail = async (
    employeeName: string,
    employeeEmail: string,
    pin: string,
    companyCode: string
): Promise<boolean> => {
    if (!SERVICE_ID || !TEMPLATE_WELCOME_ID || !PUBLIC_KEY) {
        console.warn('EmailJS not configured. Skipping email send.');
        return false;
    }

    try {
        const templateParams: Record<string, unknown> = {
            to_name: employeeName,
            to_email: employeeEmail,
            pin_code: pin,
            company_code: companyCode,
            login_url: window.location.origin,
        };

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_WELCOME_ID,
            templateParams,
            PUBLIC_KEY
        );

        return true;
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        return false;
    }
};

export const sendVerificationRequestEmail = async (
    adminEmail: string,
    newUserName: string,
    newUserPin: string
): Promise<boolean> => {
    if (!SERVICE_ID || !TEMPLATE_WELCOME_ID || !PUBLIC_KEY) {
        return false;
    }

    try {
        // Reuse Welcome/Notification template logic for admin
        const templateParams: Record<string, unknown> = {
            to_name: "Administrador",
            to_email: adminEmail,
            company_code: `NUEVO USUARIO: ${newUserName}`,
            pin_code: `PIN: ${newUserPin}`,
            login_url: `${window.location.origin}/admin`,
            message: "Un nuevo usuario se ha registrado y requiere confirmación."
        };

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_WELCOME_ID,
            templateParams,
            PUBLIC_KEY
        );

        return true;
    } catch (error) {
        console.error('Failed to send verification email:', error);
        return false;
    }
};

export const sendResetPasswordEmail = async (
    userEmail: string,
    userName: string,
    resetUrl: string
): Promise<boolean> => {
    if (!SERVICE_ID || !TEMPLATE_RESET_ID || !PUBLIC_KEY) {
        console.warn('EmailJS Reset Template not configured.');
        return false;
    }

    try {
        const templateParams: Record<string, unknown> = {
            to_name: userName,
            to_email: userEmail,
            reset_url: resetUrl,
            // Optional fields for the template
            origin_ip: "Solicitado vía Web",
            device_info: navigator.userAgent
        };

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_RESET_ID,
            templateParams,
            PUBLIC_KEY
        );

        return true;
    } catch (error) {
        console.error('Failed to send reset password email:', error);
        return false;
    }
};
