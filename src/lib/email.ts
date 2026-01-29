import emailjs from '@emailjs/browser';

// Service configuration from environment variables
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

// Interface for template params (documentation only)
// interface WelcomeEmailParams { ... }

export const sendWelcomeEmail = async (
    employeeName: string,
    employeeEmail: string,
    pin: string,
    companyCode: string
): Promise<boolean> => {
    // Basic validation to check if keys are configured
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY ||
        SERVICE_ID === 'your_service_id' ||
        TEMPLATE_ID.includes('your_') ||
        PUBLIC_KEY.includes('your_')) {
        console.warn('EmailJS not configured. Skipping email send.');
        return false;
    }

    try {
        const templateParams: Record<string, unknown> = {
            to_name: employeeName,
            to_email: employeeEmail,
            pin_code: pin,
            company_code: companyCode,
            login_url: window.location.origin, // e.g., https://geohacker.app
        };

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
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
    // Basic validation
    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY ||
        SERVICE_ID === 'your_service_id') {
        return false;
    }

    try {
        // We reuse the existing template but repurpose fields to notify admin
        // Ideally, we would use a different template ID for this.
        // For now, we fit the message into the available slots.
        const templateParams: Record<string, unknown> = {
            to_name: "Administrador",
            to_email: adminEmail,
            // We use 'company_code' and 'pin_code' slots to convey the message
            company_code: `NUEVO USUARIO: ${newUserName}`,
            pin_code: `PIN: ${newUserPin} (PENDIENTE)`,
            login_url: `${window.location.origin}/admin`,
            message: "Un nuevo usuario se ha registrado y requiere verificación manual."
        };

        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            templateParams,
            PUBLIC_KEY
        );

        return true;
    } catch (error) {
        console.error('Failed to send verification email:', error);
        return false;
    }
};
