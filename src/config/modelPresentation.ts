export interface ModelPresentation {
  cover_url: string;
  price_hint: string;
}

const driveCover=(id:string)=>`https://drive.google.com/thumbnail?id=${id}&sz=w1600`;

const PRESENTATION:Record<string,ModelPresentation>={
  'wan-3-0-prime':{cover_url:driveCover('1jG_sNvBvhca9Hmj77UlyCpUmHSTMQDYS'),price_hint:'120 cr/s'},
  'seedance-2-5':{cover_url:driveCover('1LZyBMOjcC4-eRg6W61PctVt7ycBkTOPw'),price_hint:'80 cr/s'},
  'wan-3-0':{cover_url:driveCover('1ic6HgHu4O5a134dTN2G1FDODsAA80gRR'),price_hint:'70 cr/s'},
  'kling-3-0':{cover_url:driveCover('1F0Dj5eC3m8B6fc6m4dTECeH9aMTN30Bj'),price_hint:'60 cr/s'},
  'google-omni-flash':{cover_url:driveCover('1fkat5WaR1vMd7PJ2E2KvL5Y2fJ7pHubJ'),price_hint:'50 cr/s'},
  'minimax-h3':{cover_url:driveCover('1SW5WZprdgPN6gjL42YgsNdkj0AMWSUt5'),price_hint:'55 cr/s'},
  'seedance-2-0':{cover_url:driveCover('1XXkmZSxAMTWmFygUfWFtg0BFhoxCXgJT'),price_hint:'65 cr/s'},
  'nano-banana-pro-image':{cover_url:driveCover('1TQJYby_GapKKKENtVUS00ztRH0XZhvGg'),price_hint:'90 cr/img'},
  'nano-banana-2-image':{cover_url:driveCover('1gekMMYidKEDK0YZl6XdumapHgJKNArag'),price_hint:'70 cr/img'},
  'nano-banana-2-lite-image':{cover_url:driveCover('1a0cAfzQWc8Q8SOssKng8mIRtOXH3bElU'),price_hint:'60 cr/img'},
  'seedream-5-pro-image':{cover_url:driveCover('1DI0yXNvoJqELLv2PCjp_DOZybTKR7Ysi'),price_hint:'60 cr/img'},
  'gpt-image-2':{cover_url:driveCover('1HWhLbdBrsQ2U1PKN9xg0kcrPObP1zdEn'),price_hint:'80 cr/img'},
};

export function getModelPresentation(modelId?:string|null):ModelPresentation{
  return PRESENTATION[String(modelId||'')]||{cover_url:'',price_hint:'Preço ao selecionar'};
}
