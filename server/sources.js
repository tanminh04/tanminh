// Danh sách nguồn tin. Mỗi nguồn là một RSS/Atom feed công khai.
// Thêm/bớt nguồn ở đây; region/asset là nhãn mặc định nếu bộ phân loại không tìm ra.
module.exports = [
  { id: 'fed',      name: 'Federal Reserve',  url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'US', official: true },
  { id: 'ecb',      name: 'ECB',              url: 'https://www.ecb.europa.eu/rss/press.html',          region: 'EU', official: true },
  { id: 'boe',      name: 'Bank of England',  url: 'https://www.bankofengland.co.uk/rss/news',          region: 'UK', official: true },
  { id: 'bls',      name: 'US BLS',           url: 'https://www.bls.gov/feed/bls_latest.rss',           region: 'US', official: true },
  { id: 'cnbc',     name: 'CNBC Economy',     url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', region: 'US' },
  { id: 'fxstreet', name: 'FXStreet',         url: 'https://www.fxstreet.com/rss/news',                 asset: 'FX' },
  { id: 'vnexpress',name: 'VnExpress KD',     url: 'https://vnexpress.net/rss/kinh-doanh.rss',          region: 'VN' },
  { id: 'cafef',    name: 'CafeF Vĩ mô',      url: 'https://cafef.vn/vi-mo-dau-tu.rss',                 region: 'VN' },
];
