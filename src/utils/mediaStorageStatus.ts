export function mediaStorageErrorMessage(code?: string | null): string {
  switch (code) {
    case "ASSET_STORAGE_QUOTA_RESTRICTED":
      return "Supabase recusou o upload porque a quota de egress em cache foi excedida (HTTP 402).";
    case "ASSET_STORAGE_RESTRICTED":
      return "Supabase devolveu HTTP 402 e restringiu o acesso ao armazenamento.";
    case "ASSET_ARCHIVE_UPLOAD_FAILED":
      return "O armazenamento recusou o upload; esta tentativa não registrou a causa exata (ASSET_ARCHIVE_UPLOAD_FAILED).";
    case "ASSET_STORAGE_UNAVAILABLE":
      return "O armazenamento oficial não está configurado ou está indisponível (ASSET_STORAGE_UNAVAILABLE).";
    case "ASSET_ARCHIVE_FETCH_FAILED":
      return "Não foi possível recuperar o arquivo na URL fornecida pelo provedor (ASSET_ARCHIVE_FETCH_FAILED).";
    case "ASSET_ARCHIVE_TOO_LARGE":
      return "O arquivo gerado excede o limite atual de arquivamento (ASSET_ARCHIVE_TOO_LARGE).";
    case "ASSET_ARCHIVE_EMPTY":
      return "O provedor retornou um arquivo vazio (ASSET_ARCHIVE_EMPTY).";
    case "ASSET_ARCHIVE_SOURCE_INVALID":
      return "O provedor retornou uma URL inválida para o arquivo gerado (ASSET_ARCHIVE_SOURCE_INVALID).";
    case "ASSET_ARCHIVE_NOT_VISIBLE":
      return "O arquivo foi enviado, mas o armazenamento ainda não confirmou a leitura pública (ASSET_ARCHIVE_NOT_VISIBLE).";
    default:
      return code
        ? `Falha ao salvar a mídia (código ${code}).`
        : "O resultado ainda não foi salvo no armazenamento permanente.";
  }
}
