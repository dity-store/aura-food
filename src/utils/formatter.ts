export const getFormattedMenuDisplay = (menuName: string, variantName: string): string => {
  const name = menuName.trim();
  const variant = variantName.trim();
  
  if (variant === 'Dingin') {
    if (name === 'Lemonade') return 'Es Lemonade';
    if (name === 'Lemontea') return 'Es Lemontea';
    if (name === 'Jeruk') return 'Es Jeruk';
    if (name === 'Kopi') return 'Es Kopi';
    if (name === 'Teh') return 'Es Teh';
  }
  if (variant === 'Panas') {
    if (name === 'Kopi') return 'Kopi Panas';
  }
  return `${name}${variant !== 'Reguler' ? ' (' + variant + ')' : ''}`;
};
