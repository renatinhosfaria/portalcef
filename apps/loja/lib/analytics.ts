type AnalyticsEvent = {
    action: string;
    category: string;
    label?: string;
    value?: number;
    [key: string]: unknown;
};

/**
 * Utilitário para rastreamento de analytics
 * Pode ser integrado com Google Analytics 4, Plausible, Mixpanel, etc.
 */
export const trackEvent = ({ action, category, label, value, ...props }: AnalyticsEvent) => {
    // Evitar erros no server-side
    if (typeof window === 'undefined') return;

    // Log em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        console.log(`📊 [Analytics] ${category} > ${action}`, { label, value, ...props });
    }

    // TODO: Integrar com provider real (ex: window.gtag)
    // if (window.gtag) {
    //   window.gtag('event', action, {
    //     event_category: category,
    //     event_label: label,
    //     value: value,
    //     ...props
    //   });
    // }
};
