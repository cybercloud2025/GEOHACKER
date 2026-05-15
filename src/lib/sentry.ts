import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
    if (!dsn) {
        console.info('[Sentry] DSN no configurado. Saltando inicialización.');
        return;
    }

    Sentry.init({
        dsn,
        environment: (import.meta.env.MODE as string) || 'production',
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true
            })
        ],
        beforeSend(event) {
            if (event.request?.cookies) delete event.request.cookies;
            if (event.user) {
                delete event.user.email;
                delete event.user.ip_address;
            }
            return event;
        }
    });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export const captureException = Sentry.captureException;
