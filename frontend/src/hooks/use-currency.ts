import { useState, useEffect } from 'react';
import { getActiveCurrency, CurrencyConfig, formatCurrency, EXCHANGE_RATES } from '@/lib/utils';

export function useCurrency() {
  const [currency, setCurrency] = useState<CurrencyConfig>(getActiveCurrency());

  useEffect(() => {
    const handleCurrencyChanged = () => {
      setCurrency(getActiveCurrency());
    };
    window.addEventListener("bos-currency-changed", handleCurrencyChanged);
    return () => window.removeEventListener("bos-currency-changed", handleCurrencyChanged);
  }, []);

  return { currency, formatCurrency, exchangeRates: EXCHANGE_RATES };
}
