import{describe,expect,it}from'vitest';
import{isModelCompatibleWithRequirements}from'./modelCompatibilityService.js';

describe('Routing V2 model compatibility',()=>{
  it('does not infer operational controls from a READY route alone',()=>{
    const base={capability_id:'music' as const,duration_seconds:60,parameters:{instrumental:true,output_format:'mp3'}};
    expect(isModelCompatibleWithRequirements({},base)).toBe(false);
    expect(isModelCompatibleWithRequirements({supported_durations:[60]},base)).toBe(false);
    expect(isModelCompatibleWithRequirements({supported_durations:[60],supports_instrumental:true,supported_output_formats:['mp3']},base)).toBe(true);
  });
  it('requires declared reference and output support',()=>{
    const input={capability_id:'image-to-3d' as const,reference_types:['IMAGE'],parameters:{mesh_mode:'TEXTURED',topology:'QUAD'},number_of_outputs:1};
    expect(isModelCompatibleWithRequirements({},input)).toBe(false);
    expect(isModelCompatibleWithRequirements({supports_image_reference:true,supported_mesh_modes:['TEXTURED'],supported_topologies:['TRIANGLE']},input)).toBe(false);
    expect(isModelCompatibleWithRequirements({supports_image_reference:true,max_reference_images:1,supported_mesh_modes:['TEXTURED'],supported_topologies:['QUAD']},input)).toBe(true);
    expect(isModelCompatibleWithRequirements({supports_image_reference:true,max_reference_images:1,supported_mesh_modes:['TEXTURED'],supported_topologies:['QUAD']},{...input,reference_types:['IMAGE','IMAGE']})).toBe(false);
  });
  it('does not require fictional duration support for still images or speech',()=>{
    expect(isModelCompatibleWithRequirements({}, {capability_id:'text-to-image',duration_seconds:1})).toBe(true);
    expect(isModelCompatibleWithRequirements({}, {capability_id:'text-to-speech',duration_seconds:1})).toBe(true);
    expect(isModelCompatibleWithRequirements({}, {capability_id:'text-to-video',duration_seconds:5})).toBe(false);
  });
});
