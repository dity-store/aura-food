import { readFileSync } from 'fs';

async function testBackend() {
  const config = JSON.parse(readFileSync('./src/utils/gas_config.json', 'utf8'));
  const url = config.webAppUrl;
  
  const res1 = await fetch(`${url}?action=get_admin_dashboard&id_cabang=All`);
  const data1 = await res1.json();
  console.log("get_admin_dashboard:", JSON.stringify(data1).substring(0, 200));

  const res2 = await fetch(`${url}?action=get_admin_reports&id_cabang=All`);
  const data2 = await res2.json();
  console.log("get_admin_reports:", JSON.stringify(data2).substring(0, 200));

  const res3 = await fetch(`${url}?action=get_data_sheet&sheet_name=Data_Buku_Kas`);
  const data3 = await res3.json();
  console.log("Data_Buku_Kas:", JSON.stringify(data3).substring(0, 200));
}

testBackend();
