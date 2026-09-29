import { routingV2CustomFormulaRegistry } from './customFormulaRegistry.js';
import { calculateRunwareCatalogPrice, RunwarePricingMetadata } from '../services/runwarePricingService.js';

routingV2CustomFormulaRegistry.register('runware-catalog-pricing-v1',(config,input)=>{
  const parameters=config.parameters||{};
  let metadata:RunwarePricingMetadata;
  try{metadata={air:String(parameters.provider_model_identifier||''),status:'live',pricingRates:JSON.parse(String(parameters.pricing_rates_json||'[]'))};}
  catch{throw Object.assign(new Error('Snapshot de preço Runware inválido.'),{code:'RUNWARE_PRICE_METADATA_INVALID'});}
  const quote=calculateRunwareCatalogPrice(metadata,{
    provider_model_identifier:String(parameters.provider_model_identifier||''),capability_id:String(parameters.capability_id||''),
    resolution:String(input.dimensions?.resolution||parameters.default_resolution||'1K'),
    duration_seconds:Number(input.duration_seconds||parameters.default_duration_seconds||1),number_of_outputs:Number(input.number_of_outputs||1),
    image_reference_count:Number(input.dimensions?.image_reference_count??parameters.default_image_reference_count??0),
    video_reference_count:Number(input.dimensions?.video_reference_count??parameters.default_video_reference_count??0),
    pricing_options:{
      quality:input.dimensions?.quality as string|number|boolean|undefined,
      model_variant:input.dimensions?.model_variant as string|number|boolean|undefined,
    },
  });
  return{
    amount:quote.amount,
    quantity:quote.unit==='output'?Math.max(1,Number(input.number_of_outputs)||1):Math.max(1,Number(input.duration_seconds||parameters.default_duration_seconds)||1),
    unit_label:quote.unit==='output'?'output':'second',
  };
});
