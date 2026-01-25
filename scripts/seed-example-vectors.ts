/**
 * Seed script to create 15 example vectors for the marketplace
 * Run with: pnpm tsx scripts/seed-example-vectors.ts
 */

import { getDb } from '../server/db';
import { latentVectors } from '../drizzle/schema';

const exampleVectors = [
  // NLP Vectors (5)
  {
    title: "GPT-3.5 Sentiment Analyzer",
    description: "High-performance sentiment analysis using GPT-3.5 embeddings. Achieves 94% accuracy on SST-2 benchmark. Optimized for social media and product reviews.",
    category: "nlp",
    vectorDimension: 1536,
    basePrice: "0.05",
    
    creatorId: 1,
    vectorFileKey: "examples/nlp/sentiment-gpt35.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/nlp/sentiment-gpt35.bin",
    performanceMetrics: JSON.stringify({
      accuracy: 0.94,
      latency_ms: 45,
      throughput_rps: 100,
      benchmark: "SST-2"
    }),
    tags: JSON.stringify(["sentiment", "gpt-3.5", "social-media", "reviews"]),
    modelArchitecture: "transformer",
    trainingDataSize: "100K samples",
    lastUpdated: new Date()
  },
  {
    title: "BERT Named Entity Recognition",
    description: "Production-ready NER model based on BERT-base. Identifies persons, organizations, locations with 96% F1 score. Supports 50+ entity types.",
    category: "nlp",
    vectorDimension: 768,
    basePrice: "0.03",
    
    creatorId: 1,
    vectorFileKey: "examples/nlp/ner-bert.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/nlp/ner-bert.bin",
    performanceMetrics: JSON.stringify({
      f1_score: 0.96,
      latency_ms: 30,
      entities_supported: 50,
      benchmark: "CoNLL-2003"
    }),
    tags: JSON.stringify(["ner", "bert", "entity-extraction", "information-extraction"]),
    modelArchitecture: "bert-base",
    trainingDataSize: "200K documents",
    lastUpdated: new Date()
  },
  {
    title: "LLaMA-2 Text Summarization",
    description: "Advanced abstractive summarization using LLaMA-2 7B. Generates coherent summaries preserving key information. Ideal for long documents and research papers.",
    category: "nlp",
    vectorDimension: 4096,
    basePrice: "0.10",
    
    creatorId: 1,
    vectorFileKey: "examples/nlp/summarization-llama2.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/nlp/summarization-llama2.bin",
    performanceMetrics: JSON.stringify({
      rouge_l: 0.42,
      latency_ms: 120,
      max_input_length: 4096,
      benchmark: "CNN/DailyMail"
    }),
    tags: JSON.stringify(["summarization", "llama-2", "abstractive", "long-form"]),
    modelArchitecture: "llama-2-7b",
    trainingDataSize: "500K articles",
    lastUpdated: new Date()
  },
  {
    title: "Claude Semantic Search",
    description: "Semantic search embeddings powered by Claude. Excellent for RAG applications and document retrieval. Supports multilingual queries.",
    category: "nlp",
    vectorDimension: 1024,
    basePrice: "0.04",
    
    creatorId: 1,
    vectorFileKey: "examples/nlp/semantic-claude.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/nlp/semantic-claude.bin",
    performanceMetrics: JSON.stringify({
      ndcg_at_10: 0.89,
      latency_ms: 35,
      languages_supported: 25,
      benchmark: "BEIR"
    }),
    tags: JSON.stringify(["semantic-search", "claude", "rag", "multilingual"]),
    modelArchitecture: "claude-instant",
    trainingDataSize: "1M documents",
    lastUpdated: new Date()
  },
  {
    title: "T5 Question Answering",
    description: "Fine-tuned T5-large for extractive QA. Answers questions from context with high precision. Optimized for FAQ systems and customer support.",
    category: "nlp",
    vectorDimension: 1024,
    basePrice: "0.06",
    
    creatorId: 1,
    vectorFileKey: "examples/nlp/qa-t5.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/nlp/qa-t5.bin",
    performanceMetrics: JSON.stringify({
      exact_match: 0.85,
      f1_score: 0.91,
      latency_ms: 50,
      benchmark: "SQuAD 2.0"
    }),
    tags: JSON.stringify(["question-answering", "t5", "extractive", "faq"]),
    modelArchitecture: "t5-large",
    trainingDataSize: "150K QA pairs",
    lastUpdated: new Date()
  },

  // Vision Vectors (5)
  {
    title: "CLIP Image Classification",
    description: "Zero-shot image classification using CLIP ViT-L/14. Classifies images into 1000+ categories without retraining. Excellent for e-commerce and content moderation.",
    category: "vision",
    vectorDimension: 768,
    basePrice: "0.08",
    
    creatorId: 1,
    vectorFileKey: "examples/vision/classification-clip.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/vision/classification-clip.bin",
    performanceMetrics: JSON.stringify({
      top1_accuracy: 0.88,
      top5_accuracy: 0.98,
      latency_ms: 60,
      benchmark: "ImageNet"
    }),
    tags: JSON.stringify(["image-classification", "clip", "zero-shot", "e-commerce"]),
    modelArchitecture: "clip-vit-l-14",
    trainingDataSize: "400M image-text pairs",
    lastUpdated: new Date()
  },
  {
    title: "YOLO Object Detection",
    description: "Real-time object detection with YOLOv8. Detects 80 object classes at 60 FPS. Perfect for surveillance, autonomous vehicles, and robotics.",
    category: "vision",
    vectorDimension: 640,
    basePrice: "0.07",
    
    creatorId: 1,
    vectorFileKey: "examples/vision/detection-yolo.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/vision/detection-yolo.bin",
    performanceMetrics: JSON.stringify({
      map_50: 0.92,
      fps: 60,
      objects_detected: 80,
      benchmark: "COCO"
    }),
    tags: JSON.stringify(["object-detection", "yolo", "real-time", "surveillance"]),
    modelArchitecture: "yolov8-large",
    trainingDataSize: "120K images",
    lastUpdated: new Date()
  },
  {
    title: "Stable Diffusion Image Generation",
    description: "Text-to-image generation using Stable Diffusion 2.1. Creates high-quality 512x512 images from prompts. Supports style transfer and inpainting.",
    category: "vision",
    vectorDimension: 1024,
    basePrice: "0.15",
    
    creatorId: 1,
    vectorFileKey: "examples/vision/generation-sd.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/vision/generation-sd.bin",
    performanceMetrics: JSON.stringify({
      fid_score: 12.5,
      resolution: "512x512",
      latency_ms: 2500,
      benchmark: "LAION-5B"
    }),
    tags: JSON.stringify(["image-generation", "stable-diffusion", "text-to-image", "creative"]),
    modelArchitecture: "stable-diffusion-2.1",
    trainingDataSize: "5B images",
    lastUpdated: new Date()
  },
  {
    title: "ResNet Face Recognition",
    description: "High-accuracy face recognition using ResNet-101. Achieves 99.8% accuracy on LFW. Supports face verification and identification for security applications.",
    category: "vision",
    vectorDimension: 512,
    basePrice: "0.05",
    
    creatorId: 1,
    vectorFileKey: "examples/vision/face-resnet.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/vision/face-resnet.bin",
    performanceMetrics: JSON.stringify({
      accuracy: 0.998,
      latency_ms: 40,
      false_positive_rate: 0.001,
      benchmark: "LFW"
    }),
    tags: JSON.stringify(["face-recognition", "resnet", "security", "biometrics"]),
    modelArchitecture: "resnet-101",
    trainingDataSize: "3M faces",
    lastUpdated: new Date()
  },
  {
    title: "SegFormer Image Segmentation",
    description: "Semantic segmentation using SegFormer-B5. Segments images into 150 classes with pixel-level precision. Ideal for medical imaging and autonomous driving.",
    category: "vision",
    vectorDimension: 768,
    basePrice: "0.09",
    
    creatorId: 1,
    vectorFileKey: "examples/vision/segmentation-segformer.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/vision/segmentation-segformer.bin",
    performanceMetrics: JSON.stringify({
      miou: 0.84,
      latency_ms: 80,
      classes: 150,
      benchmark: "ADE20K"
    }),
    tags: JSON.stringify(["segmentation", "segformer", "medical", "autonomous-driving"]),
    modelArchitecture: "segformer-b5",
    trainingDataSize: "25K images",
    lastUpdated: new Date()
  },

  // Audio Vectors (5)
  {
    title: "Whisper Speech Recognition",
    description: "Multilingual speech-to-text using Whisper Large-v3. Supports 99 languages with 95% WER. Robust to accents and background noise.",
    category: "audio",
    vectorDimension: 1280,
    basePrice: "0.10",
    
    creatorId: 1,
    vectorFileKey: "examples/audio/asr-whisper.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/audio/asr-whisper.bin",
    performanceMetrics: JSON.stringify({
      wer: 0.05,
      languages: 99,
      latency_ms: 150,
      benchmark: "Common Voice"
    }),
    tags: JSON.stringify(["speech-recognition", "whisper", "multilingual", "transcription"]),
    modelArchitecture: "whisper-large-v3",
    trainingDataSize: "680K hours",
    lastUpdated: new Date()
  },
  {
    title: "Wav2Vec Speaker Identification",
    description: "Speaker identification using Wav2Vec 2.0. Identifies speakers with 98% accuracy. Supports speaker diarization and voice biometrics.",
    category: "audio",
    vectorDimension: 768,
    basePrice: "0.06",
    
    creatorId: 1,
    vectorFileKey: "examples/audio/speaker-wav2vec.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/audio/speaker-wav2vec.bin",
    performanceMetrics: JSON.stringify({
      accuracy: 0.98,
      latency_ms: 70,
      speakers_max: 20,
      benchmark: "VoxCeleb"
    }),
    tags: JSON.stringify(["speaker-identification", "wav2vec", "diarization", "biometrics"]),
    modelArchitecture: "wav2vec2-large",
    trainingDataSize: "60K hours",
    lastUpdated: new Date()
  },
  {
    title: "MusicGen Audio Generation",
    description: "AI music generation using MusicGen. Creates original music from text descriptions. Supports multiple genres and instruments.",
    category: "audio",
    vectorDimension: 1024,
    basePrice: "0.20",
    
    creatorId: 1,
    vectorFileKey: "examples/audio/generation-musicgen.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/audio/generation-musicgen.bin",
    performanceMetrics: JSON.stringify({
      fad_score: 1.8,
      duration_max_sec: 30,
      latency_ms: 5000,
      benchmark: "MusicCaps"
    }),
    tags: JSON.stringify(["music-generation", "musicgen", "text-to-music", "creative"]),
    modelArchitecture: "musicgen-large",
    trainingDataSize: "20K hours",
    lastUpdated: new Date()
  },
  {
    title: "AudioLM Sound Classification",
    description: "Environmental sound classification using AudioLM. Classifies 527 sound events. Perfect for smart home and security systems.",
    category: "audio",
    vectorDimension: 512,
    basePrice: "0.04",
    
    creatorId: 1,
    vectorFileKey: "examples/audio/classification-audiolm.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/audio/classification-audiolm.bin",
    performanceMetrics: JSON.stringify({
      map: 0.89,
      latency_ms: 45,
      classes: 527,
      benchmark: "AudioSet"
    }),
    tags: JSON.stringify(["sound-classification", "audiolm", "environmental", "smart-home"]),
    modelArchitecture: "audiolm-base",
    trainingDataSize: "2M clips",
    lastUpdated: new Date()
  },
  {
    title: "Tacotron Text-to-Speech",
    description: "Natural text-to-speech using Tacotron 2. Generates human-like speech with emotional expression. Supports 10 voices and multiple languages.",
    category: "audio",
    vectorDimension: 512,
    basePrice: "0.08",
    
    creatorId: 1,
    vectorFileKey: "examples/audio/tts-tacotron.bin",
    vectorFileUrl: "https://storage.awareness-network.com/examples/audio/tts-tacotron.bin",
    performanceMetrics: JSON.stringify({
      mos: 4.5,
      voices: 10,
      latency_ms: 200,
      benchmark: "LJSpeech"
    }),
    tags: JSON.stringify(["text-to-speech", "tacotron", "voice-synthesis", "accessibility"]),
    modelArchitecture: "tacotron2",
    trainingDataSize: "24 hours",
    lastUpdated: new Date()
  }
];

async function seedExampleVectors() {
  console.log("🌱 Seeding example vectors...\n");
  
  const db = await getDb();
  
  if (!db) {
    console.error("❌ Failed to connect to database");
    process.exit(1);
  }
  
  try {
    for (const vector of exampleVectors) {
      console.log(`  Creating: ${vector.title} (${vector.category})`);
      
      await db.insert(latentVectors).values(vector);
    }
    
    console.log(`\n✅ Successfully created ${exampleVectors.length} example vectors!`);
    console.log("\nBreakdown:");
    console.log("  - NLP: 5 vectors");
    console.log("  - Vision: 5 vectors");
    console.log("  - Audio: 5 vectors");
    console.log("\n🎉 Example data ready for testing!");
    
  } catch (error) {
    console.error("❌ Error seeding vectors:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the seed script
seedExampleVectors();
