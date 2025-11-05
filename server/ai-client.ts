/**
 * AI Service Client
 * Handles communication with the AI processing service (PaddleOCR + GPT-4o)
 */

import FormData from 'form-data';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

export interface OCRResult {
  extracted_text: string;
  structured_data?: {
    name?: string;
    title?: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    wechat?: string;
  };
  bounding_boxes: Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }>;
  confidence: number;
}

export interface DocumentGenerationResult {
  title: string;
  content_md: string;
  summary: string;
  tags: string[];
  metadata: {
    document_type?: string;
    key_entities?: string[];
    main_topics?: string[];
  };
}

export interface CompanyEnrichmentResult {
  name: string;
  industry: string;
  description: string;
  website?: string;
  employee_count?: string;
  founded_year?: number;
  headquarters?: string;
}

export interface KeywordExtractionResult {
  keywords: string[];
  entities: {
    people: string[];
    organizations: string[];
    locations: string[];
  };
  topics: string[];
}

/**
 * Perform OCR on a base64-encoded image
 */
export async function performOCR(imageBase64: string, language: string = 'ch'): Promise<OCRResult> {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/ocr`, {
      image_base64: imageBase64,
      language,
    }, {
      timeout: 60000, // 60 seconds timeout for OCR
    });
    
    return response.data;
  } catch (error) {
    console.error('OCR request failed:', error);
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Perform OCR on an uploaded file (Buffer)
 */
export async function performOCRFromFile(fileBuffer: Buffer, filename: string): Promise<OCRResult> {
  try {
    const formData = new FormData();
    formData.append('file', fileBuffer, filename);
    
    const response = await axios.post(`${AI_SERVICE_URL}/api/ocr/file`, formData, {
      headers: formData.getHeaders(),
      timeout: 60000,
    });
    
    return response.data;
  } catch (error) {
    console.error('OCR file request failed:', error);
    throw new Error(`OCR file processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a knowledge document from extracted text
 */
export async function generateDocument(
  extractedText: string,
  documentType: 'business_card' | 'meeting_notes' | 'presentation' | 'general' = 'general',
  context?: string
): Promise<DocumentGenerationResult> {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/generate-document`, {
      extracted_text: extractedText,
      document_type: documentType,
      context,
    }, {
      timeout: 90000, // 90 seconds for document generation
    });
    
    return response.data;
  } catch (error) {
    console.error('Document generation failed:', error);
    throw new Error(`Document generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Enrich company information
 */
export async function enrichCompanyInfo(companyName: string): Promise<CompanyEnrichmentResult> {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/enrich-company`, {
      company_name: companyName,
    }, {
      timeout: 30000,
    });
    
    return response.data;
  } catch (error) {
    console.error('Company enrichment failed:', error);
    throw new Error(`Company enrichment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract keywords and entities from text
 */
export async function extractKeywords(text: string, maxKeywords: number = 10): Promise<KeywordExtractionResult> {
  try {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('max_keywords', maxKeywords.toString());
    
    const response = await axios.post(`${AI_SERVICE_URL}/api/extract-keywords`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });
    
    return response.data;
  } catch (error) {
    console.error('Keyword extraction failed:', error);
    throw new Error(`Keyword extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if AI service is healthy
 */
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    
    return response.data.status === 'healthy';
  } catch (error) {
    console.error('AI service health check failed:', error);
    return false;
  }
}
