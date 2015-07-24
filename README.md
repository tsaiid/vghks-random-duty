# VGHKS Random Duty Generator

A single page application to assist resident duty arrangement for Radiology department of VGHKS.

符合高榮放射線部住院醫師排班規則的排班小工具。

Demo: [http://radtools.tsai.it/vghks-random-duty/]()

## Feature

1. 從 Google calendar 下載台灣版假日行事曆，如與實際有差異，也可自訂假日
2. 可設定不值人員
3. 可依該月總點數（星期五為 1 點，假日為 2 點）產生建議班數分配，也可手動調整
4. 亂數產生班表，預設為不連值，可設定 qod 值班上限，或班距標準差上限

## Limitation

1. 無法於網頁版儲存結果，僅可匯出 excel 檔
2. 經更動的 google calendar 假日如有切換月份會失效

## License

MIT License
