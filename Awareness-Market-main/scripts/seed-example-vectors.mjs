import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { latentVectors, users } from '../drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;

async function seedExampleVectors() {
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('🌱 Seeding example vectors...');

  // Find or create demo creator
  const [demoUser] = await db.select().from(users).where(eq(users.email, 'demo@awareness-network.com')).limit(1);
  
  let creatorId;
  if (!demoUser) {
    const [result] = await db.insert(users).values({
      openId: 'demo_creator_' + Date.now(),
      name: 'Awareness Network Demo',
      email: 'demo@awareness-network.com',
      loginMethod: 'email',
      role: 'creator'
    });
    creatorId = result.insertId;
  } else {
    creatorId = demoUser.id;
  }

  const exampleVectors = [
    // NLP Category
    {
      name: 'Sentiment Analysis Pro',
      description: 'State-of-the-art sentiment classification trained on 1M+ reviews. Achieves 94% accuracy on SST-2 benchmark. Supports fine-grained emotion detection (joy, sadness, anger, fear, surprise).',
      category: 'nlp',
      price: '0.02',
      modelType: 'bert',
      dimension: 768,
      rating: '4.8',
      downloads: 1523,
      creatorId,
      vector_file_key: `demo/nlp/sentiment-analysis-pro-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/sentiment-analysis-pro.bin',
      tags: JSON.stringify(['sentiment', 'classification', 'nlp', 'bert'])
    },
    {
      name: 'Named Entity Recognition',
      description: 'High-precision NER model for person, organization, location, and date extraction. Trained on CoNLL-2003 dataset with 91% F1 score. Supports 15 entity types.',
      category: 'nlp',
      price: '0.03',
      modelType: 'gpt-3.5',
      dimension: 768,
      rating: '4.6',
      downloads: 892,
      creatorId,
      vector_file_key: `demo/nlp/ner-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/ner.bin',
      tags: JSON.stringify(['ner', 'entity-extraction', 'nlp', 'gpt'])
    },
    {
      name: 'Text Summarization Engine',
      description: 'Abstractive summarization model that generates concise summaries while preserving key information. Trained on CNN/DailyMail dataset. Supports multi-document summarization.',
      category: 'nlp',
      price: '0.05',
      modelType: 'gpt-4',
      dimension: 1024,
      rating: '4.9',
      downloads: 2341,
      creatorId,
      vector_file_key: `demo/nlp/summarization-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/summarization.bin',
      tags: JSON.stringify(['summarization', 'abstractive', 'nlp', 'gpt-4'])
    },
    {
      name: 'Question Answering System',
      description: 'BERT-based QA model fine-tuned on SQuAD 2.0. Achieves 89% EM and 92% F1. Handles unanswerable questions and provides confidence scores.',
      category: 'nlp',
      price: '0.04',
      modelType: 'bert',
      dimension: 768,
      rating: '4.7',
      downloads: 1156,
      creatorId,
      vector_file_key: `demo/nlp/qa-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/qa.bin',
      tags: JSON.stringify(['qa', 'question-answering', 'nlp', 'bert', 'squad'])
    },
    {
      name: 'Language Detection',
      description: 'Fast and accurate language identification for 100+ languages. Trained on multilingual corpora. Achieves 99% accuracy on common languages.',
      category: 'nlp',
      price: '0.01',
      modelType: 'bert',
      dimension: 768,
      rating: '4.5',
      downloads: 3421,
      creatorId,
      vector_file_key: `demo/nlp/lang-detect-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/lang-detect.bin',
      tags: JSON.stringify(['language-detection', 'multilingual', 'nlp'])
    },

    // Vision Category
    {
      name: 'Object Detection Pro',
      description: 'YOLOv8-based object detection for 80 COCO classes. Real-time performance (60+ FPS). Includes bounding boxes, confidence scores, and class labels.',
      category: 'vision',
      price: '0.10',
      modelType: 'resnet',
      dimension: 2048,
      rating: '4.8',
      downloads: 1876,
      creatorId,
      vector_file_key: `demo/vision/object-detection-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/object-detection.bin',
      tags: JSON.stringify(['object-detection', 'yolo', 'vision', 'real-time'])
    },
    {
      name: 'Image Classification',
      description: 'ResNet-50 trained on ImageNet with 1000 classes. 92% top-5 accuracy. Includes feature extraction layer for transfer learning.',
      category: 'vision',
      price: '0.05',
      modelType: 'resnet',
      dimension: 2048,
      rating: '4.7',
      downloads: 2134,
      creatorId,
      vector_file_key: `demo/vision/image-classification-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/image-classification.bin',
      tags: JSON.stringify(['classification', 'resnet', 'vision', 'imagenet'])
    },
    {
      name: 'Face Recognition',
      description: 'High-accuracy face recognition and verification. Trained on 5M+ faces. Supports face detection, alignment, and embedding generation. 99.2% accuracy on LFW.',
      category: 'vision',
      price: '0.15',
      modelType: 'facenet',
      dimension: 512,
      rating: '4.9',
      downloads: 3421,
      creatorId,
      vector_file_key: `demo/vision/face-recognition-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/face-recognition.bin',
      tags: JSON.stringify(['face-recognition', 'biometric', 'vision', 'facenet'])
    },
    {
      name: 'Scene Understanding',
      description: 'Multi-task model for scene classification, object detection, and semantic segmentation. Trained on Places365 and ADE20K. Understands indoor/outdoor contexts.',
      category: 'vision',
      price: '0.12',
      modelType: 'resnet',
      dimension: 2048,
      rating: '4.6',
      downloads: 987,
      creatorId,
      vector_file_key: `demo/vision/scene-understanding-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/scene-understanding.bin',
      tags: JSON.stringify(['scene-understanding', 'segmentation', 'vision', 'multi-task'])
    },
    {
      name: 'Image Similarity Search',
      description: 'Perceptual hashing and deep learning embeddings for image similarity. Supports reverse image search, duplicate detection, and visual recommendations.',
      category: 'vision',
      price: '0.08',
      modelType: 'resnet',
      dimension: 2048,
      rating: '4.7',
      downloads: 1543,
      creatorId,
      vector_file_key: `demo/vision/image-similarity-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/image-similarity.bin',
      tags: JSON.stringify(['similarity', 'search', 'vision', 'embeddings'])
    },

    // Audio Category
    {
      name: 'Speech Recognition',
      description: 'Whisper-based ASR for 99 languages. Achieves near-human accuracy on English. Supports timestamps, speaker diarization, and punctuation restoration.',
      category: 'audio',
      price: '0.06',
      modelType: 'whisper',
      dimension: 512,
      rating: '4.9',
      downloads: 2876,
      creatorId,
      vector_file_key: `demo/audio/speech-recognition-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/speech-recognition.bin',
      tags: JSON.stringify(['asr', 'speech-recognition', 'audio', 'whisper'])
    },
    {
      name: 'Audio Classification',
      description: 'Classify audio into 527 categories (music, speech, environmental sounds). Trained on AudioSet. Real-time inference on CPU.',
      category: 'audio',
      price: '0.03',
      modelType: 'yamnet',
      dimension: 1024,
      rating: '4.5',
      downloads: 1234,
      creatorId,
      vector_file_key: `demo/audio/audio-classification-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/audio-classification.bin',
      tags: JSON.stringify(['classification', 'audio', 'yamnet', 'audioset'])
    },
    {
      name: 'Music Genre Detection',
      description: 'Identify music genres with 95% accuracy. Supports 10 major genres (rock, pop, jazz, classical, etc.). Includes tempo and key detection.',
      category: 'audio',
      price: '0.04',
      modelType: 'musicnn',
      dimension: 512,
      rating: '4.6',
      downloads: 876,
      creatorId,
      vector_file_key: `demo/audio/music-genre-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/music-genre.bin',
      tags: JSON.stringify(['music', 'genre', 'audio', 'classification'])
    },
    {
      name: 'Voice Activity Detection',
      description: 'Precise VAD for speech/non-speech segmentation. Low latency (10ms). Robust to noise and music. Ideal for voice assistants and transcription.',
      category: 'audio',
      price: '0.02',
      modelType: 'silero',
      dimension: 256,
      rating: '4.7',
      downloads: 1987,
      creatorId,
      vector_file_key: `demo/audio/vad-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/vad.bin',
      tags: JSON.stringify(['vad', 'voice-activity', 'audio', 'real-time'])
    },
    {
      name: 'Audio Emotion Recognition',
      description: 'Detect emotions from speech audio (happy, sad, angry, neutral, surprised). Trained on RAVDESS and IEMOCAP datasets. 87% accuracy.',
      category: 'audio',
      price: '0.05',
      modelType: 'wav2vec',
      dimension: 768,
      rating: '4.4',
      downloads: 654,
      creatorId,
      vector_file_key: `demo/audio/emotion-recognition-${Date.now()}.bin`,
      vector_file_url: 'https://storage.awareness-network.com/demo/emotion-recognition.bin',
      tags: JSON.stringify(['emotion', 'speech', 'audio', 'affective'])
    }
  ];

  for (const vector of exampleVectors) {
    await db.insert(latentVectors).values(vector);
    console.log(`✅ Created: ${vector.name}`);
  }

  console.log(`\n🎉 Successfully seeded ${exampleVectors.length} example vectors!`);
  await connection.end();
}

seedExampleVectors().catch(console.error);
