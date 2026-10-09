const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function trendAxisLabel(bucket: string): string {
  const week = /^(\d{4})-W(\d{2})$/.exec(bucket);
  if (week) return `Mgg ${Number(week[2])}`;
  const month = /^(\d{4})-(\d{2})$/.exec(bucket);
  if (month) {
    const name = MONTHS[Number(month[2]) - 1];
    return name ? `${name} ${month[1]}` : bucket;
  }
  return bucket;
}

export function trendTipLabel(bucket: string): string {
  const week = /^(\d{4})-W(\d{2})$/.exec(bucket);
  return week ? `Minggu ${Number(week[2])}` : trendAxisLabel(bucket);
}
