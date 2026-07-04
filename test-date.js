const parseDate = (dStr) => {
    if (!dStr) return new Date(NaN);
    const s = dStr.trim();
    if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
        const parts = s.split(' ');
        const dParts = parts[0].split('/');
        const time = parts[1] || '00:00:00';
        return new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T${time}+08:00`);
    }
    if (s.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
        return new Date(`${s.replace(' ', 'T')}:00+08:00`);
    }
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(`${s}T00:00:00+08:00`);
    }
    return new Date(s.replace(' ', 'T'));
};
console.log(parseDate("2026-07-04"));
console.log(parseDate("2026-07-04 - 2026-07-05".split(' - ')[1]));
