import axios from 'axios';
import type {
  CardData,
  ExportJob,
  ExportOptions,
  FieldMapping,
  ImageListResponse,
  SheetResponse,
  TemplateListResponse,
} from '@cardmaker/shared';

const api = axios.create({ baseURL: '/api' });

export async function fetchSheetData(url: string): Promise<SheetResponse> {
  const { data } = await api.get('/sheets/fetch', { params: { url } });
  return data;
}

export async function fetchTemplates(): Promise<TemplateListResponse> {
  const { data } = await api.get('/templates');
  return data;
}

export async function fetchTemplate(id: string) {
  const { data } = await api.get(`/templates/${id}`);
  return data;
}

export async function fetchImages(): Promise<ImageListResponse> {
  const { data } = await api.get('/images');
  return data;
}

export async function renderPreview(
  templateId: string,
  cardData: CardData,
  mapping: FieldMapping
): Promise<string> {
  const { data } = await api.post('/cards/preview', {
    templateId,
    cardData,
    mapping,
  });
  return data.dataUrl;
}

export async function renderPreviewBatch(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping
): Promise<string[]> {
  const { data } = await api.post('/cards/preview-batch', {
    templateId,
    cards,
    mapping,
  });
  return data.dataUrls;
}

export async function startExport(
  templateId: string,
  cards: CardData[],
  mapping: FieldMapping,
  options: ExportOptions
): Promise<string> {
  const { data } = await api.post('/export', {
    templateId,
    cards,
    mapping,
    options,
  });
  return data.jobId;
}

export async function getExportJob(jobId: string): Promise<ExportJob> {
  const { data } = await api.get(`/export/${jobId}`);
  return data;
}
