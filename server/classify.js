// Phân loại tin bằng từ khoá: khu vực, loại tài sản, mức độ quan trọng.
// Đây là bản rule-based đơn giản; có thể thay bằng LLM ở bước sau.

const REGION_RULES = [
  ['US', /\b([Ff]ed|FOMC|Powell|[Tt]reasury|[Nn]onfarm|[Pp]ayrolls|Wall Street|[Dd]ollar)\b|\bU\.S\.|\bUS\b/],
  ['EU', /\b(ecb|lagarde|euro ?zone|eurozone|bund|germany|france|italy)\b/i],
  ['UK', /\b([Bb]o[Ee]|[Bb]ank of [Ee]ngland|Bailey|[Gg]ilts?|[Ss]terling|U\.?K\.?|Britain)\b/],
  ['JP', /\b(boj|ueda|japan|yen|jgb)\b/i],
  ['CN', /\b(pboc|china|chinese|yuan|renminbi|beijing)\b/i],
  ['VN', /(việt nam|vietnam|nhnn|sbv|vn-index|vnindex|tỷ giá|ngân hàng nhà nước)/i],
];

const ASSET_RULES = [
  ['Rates',  /\b(rate|yield|bond|treasur|gilt|bund|lãi suất|trái phiếu)/i],
  ['FX',     /\b(dollar|euro|yen|yuan|sterling|fx|currency|usd|eur|jpy|tỷ giá)/i],
  ['Equity', /\b(stock|equit|s&p|nasdaq|dow|shares|cổ phiếu|chứng khoán|vn-index)/i],
  ['Commod', /\b(oil|crude|brent|wti|gold|copper|opec|dầu|vàng)/i],
  ['Macro',  /\b(cpi|inflation|gdp|pmi|jobs|payroll|unemployment|retail sales|lạm phát|tăng trưởng)/i],
];

const HIGH = /\b(fomc|rate decision|hikes?|cuts?|cpi|nonfarm|payrolls|gdp|emergency|breaking|surprise|default|tariff|lãi suất điều hành|khẩn)/i;
const MED  = /\b(pmi|retail sales|minutes|speech|testimony|inflation|unemployment|outlook|forecast|lạm phát)/i;

function classify(text, source) {
  const regions = REGION_RULES.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (!regions.length && source.region) regions.push(source.region);
  const assets = ASSET_RULES.filter(([, re]) => re.test(text)).map(([k]) => k);
  if (!assets.length && source.asset) assets.push(source.asset);
  let impact = HIGH.test(text) ? 3 : MED.test(text) ? 2 : 1;
  if (source.official && impact < 2) impact = 2;
  return { regions, assets, impact };
}

module.exports = { classify };
