export const TIMEZONE = 'Asia/Makassar';

export const getCurrentDate = () => {
  return new Date();
};

export const formatToIDTime = (date: Date | string | number) => {
  return new Date(date).toLocaleTimeString('id-ID', { timeZone: TIMEZONE });
};

export const formatToIDDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
  return new Date(date).toLocaleDateString('id-ID', { timeZone: TIMEZONE, ...options });
};

export const formatToIDDateTime = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
  return new Date(date).toLocaleString('id-ID', { timeZone: TIMEZONE, ...options });
};

export const getWITAString = (date: Date | string | number = new Date()) => {
  return new Date(date).toLocaleString('sv-SE', { timeZone: TIMEZONE }).replace(' ', 'T');
};
