/**
 * W-Matrix Protocol Tests
 */

import { describe, it, expect } from 'vitest';
import {
  QualityCertifier,
  WMatrixVersionManager,
  IntegrityVerifier,
  ModelCompatibilityMatrix,
  WMatrixProtocolBuilder,
} from './w-matrix-protocol';

describe('QualityCertifier', () => {
  describe('getCertificationLevel', () => {
    it('should return platinum for epsilon <= 0.01', () => {
      expect(QualityCertifier.getCertificationLevel(0.005)).toBe('platinum');
      expect(QualityCertifier.getCertificationLevel(0.01)).toBe('platinum');
    });
    
    it('should return gold for epsilon <= 0.05', () => {
      expect(QualityCertifier.getCertificationLevel(0.02)).toBe('gold');
      expect(QualityCertifier.getCertificationLevel(0.05)).toBe('gold');
    });
    
    it('should return silver for epsilon <= 0.10', () => {
      expect(QualityCertifier.getCertificationLevel(0.08)).toBe('silver');
      expect(QualityCertifier.getCertificationLevel(0.10)).toBe('silver');
    });
    
    it('should return bronze for epsilon > 0.10', () => {
      expect(QualityCertifier.getCertificationLevel(0.15)).toBe('bronze');
      expect(QualityCertifier.getCertificationLevel(0.50)).toBe('bronze');
    });
  });
  
  describe('getQualityGrade', () => {
    it('should return correct quality grades', () => {
      expect(QualityCertifier.getQualityGrade(0.01)).toBe('excellent');
      expect(QualityCertifier.getQualityGrade(0.03)).toBe('good');
      expect(QualityCertifier.getQualityGrade(0.08)).toBe('fair');
      expect(QualityCertifier.getQualityGrade(0.15)).toBe('poor');
    });
  });
  
  describe('createCertification', () => {
    it('should create valid certification', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      
      expect(cert.level).toBe('gold');
      expect(cert.epsilon).toBe(0.03);
      expect(cert.cosineSimilarity).toBe(0.95);
      expect(cert.euclideanDistance).toBe(0.1);
      expect(cert.testSamples).toBe(1000);
      expect(cert.certifiedAt).toBeInstanceOf(Date);
      expect(cert.expiresAt).toBeInstanceOf(Date);
      
      // Should expire in 1 year
      const yearFromNow = new Date();
      yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
      expect(cert.expiresAt.getTime()).toBeCloseTo(yearFromNow.getTime(), -4);
    });
  });
  
  describe('isValid', () => {
    it('should return true for valid certification', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      expect(QualityCertifier.isValid(cert)).toBe(true);
    });
    
    it('should return false for expired certification', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      cert.expiresAt = new Date('2020-01-01');
      expect(QualityCertifier.isValid(cert)).toBe(false);
    });
  });
  
  describe('getExpiryStatus', () => {
    it('should return active status for valid certification', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      const status = QualityCertifier.getExpiryStatus(cert);
      
      expect(status.isValid).toBe(true);
      expect(status.daysRemaining).toBeGreaterThan(300);
      expect(status.status).toBe('active');
    });
    
    it('should return expiring-soon status', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      const expiresIn20Days = new Date();
      expiresIn20Days.setDate(expiresIn20Days.getDate() + 20);
      cert.expiresAt = expiresIn20Days;
      
      const status = QualityCertifier.getExpiryStatus(cert);
      expect(status.status).toBe('expiring-soon');
    });
    
    it('should return expired status', () => {
      const cert = QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000);
      cert.expiresAt = new Date('2020-01-01');
      
      const status = QualityCertifier.getExpiryStatus(cert);
      expect(status.isValid).toBe(false);
      expect(status.status).toBe('expired');
    });
  });
});

describe('WMatrixVersionManager', () => {
  describe('parseVersion', () => {
    it('should parse valid version string', () => {
      const version = WMatrixVersionManager.parseVersion('1.2.3');
      expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
    });
    
    it('should throw error for invalid version string', () => {
      expect(() => WMatrixVersionManager.parseVersion('1.2')).toThrow();
      expect(() => WMatrixVersionManager.parseVersion('abc')).toThrow();
    });
  });
  
  describe('formatVersion', () => {
    it('should format version to string', () => {
      const str = WMatrixVersionManager.formatVersion({ major: 1, minor: 2, patch: 3 });
      expect(str).toBe('1.2.3');
    });
  });
  
  describe('compareVersions', () => {
    it('should compare major versions', () => {
      const v1 = { major: 2, minor: 0, patch: 0 };
      const v2 = { major: 1, minor: 9, patch: 9 };
      expect(WMatrixVersionManager.compareVersions(v1, v2)).toBeGreaterThan(0);
    });
    
    it('should compare minor versions', () => {
      const v1 = { major: 1, minor: 5, patch: 0 };
      const v2 = { major: 1, minor: 3, patch: 9 };
      expect(WMatrixVersionManager.compareVersions(v1, v2)).toBeGreaterThan(0);
    });
    
    it('should compare patch versions', () => {
      const v1 = { major: 1, minor: 2, patch: 5 };
      const v2 = { major: 1, minor: 2, patch: 3 };
      expect(WMatrixVersionManager.compareVersions(v1, v2)).toBeGreaterThan(0);
    });
  });
  
  describe('isNewer', () => {
    it('should return true for newer version', () => {
      const newer = { major: 1, minor: 2, patch: 3 };
      const older = { major: 1, minor: 2, patch: 2 };
      expect(WMatrixVersionManager.isNewer(newer, older)).toBe(true);
    });
  });
  
  describe('incrementVersion', () => {
    it('should increment major version', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      const incremented = WMatrixVersionManager.incrementVersion(version, 'major');
      expect(incremented).toEqual({ major: 2, minor: 0, patch: 0 });
    });
    
    it('should increment minor version', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      const incremented = WMatrixVersionManager.incrementVersion(version, 'minor');
      expect(incremented).toEqual({ major: 1, minor: 3, patch: 0 });
    });
    
    it('should increment patch version', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      const incremented = WMatrixVersionManager.incrementVersion(version, 'patch');
      expect(incremented).toEqual({ major: 1, minor: 2, patch: 4 });
    });
  });
  
  describe('isCompatible', () => {
    it('should return true for compatible versions', () => {
      const required = { major: 1, minor: 2, patch: 0 };
      const available = { major: 1, minor: 2, patch: 5 };
      expect(WMatrixVersionManager.isCompatible(required, available)).toBe(true);
    });
    
    it('should return false for incompatible major version', () => {
      const required = { major: 2, minor: 0, patch: 0 };
      const available = { major: 1, minor: 9, patch: 9 };
      expect(WMatrixVersionManager.isCompatible(required, available)).toBe(false);
    });
    
    it('should return false for incompatible minor version', () => {
      const required = { major: 1, minor: 5, patch: 0 };
      const available = { major: 1, minor: 3, patch: 9 };
      expect(WMatrixVersionManager.isCompatible(required, available)).toBe(false);
    });
  });
});

describe('IntegrityVerifier', () => {
  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum', () => {
      const data = 'test data';
      const checksum = IntegrityVerifier.calculateChecksum(data);
      
      expect(checksum).toBe('916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9');
      expect(checksum.length).toBe(64); // SHA-256 is 64 hex chars
    });
    
    it('should produce different checksums for different data', () => {
      const checksum1 = IntegrityVerifier.calculateChecksum('data1');
      const checksum2 = IntegrityVerifier.calculateChecksum('data2');
      
      expect(checksum1).not.toBe(checksum2);
    });
  });
  
  describe('verifyIntegrity', () => {
    it('should return true for matching checksum', () => {
      const data = 'test data';
      const checksum = IntegrityVerifier.calculateChecksum(data);
      
      expect(IntegrityVerifier.verifyIntegrity(data, checksum)).toBe(true);
    });
    
    it('should return false for non-matching checksum', () => {
      const data = 'test data';
      const wrongChecksum = 'wrong_checksum';
      
      expect(IntegrityVerifier.verifyIntegrity(data, wrongChecksum)).toBe(false);
    });
  });
  
  describe('generateIntegrityReport', () => {
    it('should generate complete integrity report', () => {
      const data = 'test data';
      const expectedChecksum = IntegrityVerifier.calculateChecksum(data);
      
      const report = IntegrityVerifier.generateIntegrityReport(data, expectedChecksum);
      
      expect(report.valid).toBe(true);
      expect(report.actualChecksum).toBe(expectedChecksum);
      expect(report.expectedChecksum).toBe(expectedChecksum);
      expect(report.sizeBytes).toBeGreaterThan(0);
    });
  });
});

describe('ModelCompatibilityMatrix', () => {
  it('should add and retrieve compatibility entries', () => {
    const matrix = new ModelCompatibilityMatrix();
    
    const entry = {
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'test-id',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'gold' as const,
      epsilon: 0.03,
      available: true,
    };
    
    matrix.addEntry(entry);
    
    const entries = matrix.getCompatibleMatrices('gpt-3.5', 'gpt-4');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(entry);
  });
  
  it('should sort entries by version', () => {
    const matrix = new ModelCompatibilityMatrix();
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'v1',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'gold',
      epsilon: 0.03,
      available: true,
    });
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'v2',
      version: { major: 2, minor: 0, patch: 0 },
      certification: 'platinum',
      epsilon: 0.01,
      available: true,
    });
    
    const entries = matrix.getCompatibleMatrices('gpt-3.5', 'gpt-4');
    expect(entries[0].wMatrixId).toBe('v2'); // Newest first
    expect(entries[1].wMatrixId).toBe('v1');
  });
  
  it('should get best matrix', () => {
    const matrix = new ModelCompatibilityMatrix();
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'bronze',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'bronze',
      epsilon: 0.15,
      available: true,
    });
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'gold',
      version: { major: 2, minor: 0, patch: 0 },
      certification: 'gold',
      epsilon: 0.03,
      available: true,
    });
    
    const best = matrix.getBestMatrix('gpt-3.5', 'gpt-4');
    expect(best?.wMatrixId).toBe('gold'); // Newest available
  });
  
  it('should filter by minimum certification', () => {
    const matrix = new ModelCompatibilityMatrix();
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'bronze',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'bronze',
      epsilon: 0.15,
      available: true,
    });
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'gold',
      version: { major: 2, minor: 0, patch: 0 },
      certification: 'gold',
      epsilon: 0.03,
      available: true,
    });
    
    const best = matrix.getBestMatrix('gpt-3.5', 'gpt-4', 'gold');
    expect(best?.wMatrixId).toBe('gold');
  });
  
  it('should get statistics', () => {
    const matrix = new ModelCompatibilityMatrix();
    
    matrix.addEntry({
      sourceModel: 'gpt-3.5',
      targetModel: 'gpt-4',
      wMatrixId: 'test1',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'gold',
      epsilon: 0.03,
      available: true,
    });
    
    matrix.addEntry({
      sourceModel: 'llama-3',
      targetModel: 'gpt-4',
      wMatrixId: 'test2',
      version: { major: 1, minor: 0, patch: 0 },
      certification: 'silver',
      epsilon: 0.08,
      available: true,
    });
    
    const stats = matrix.getStatistics();
    
    expect(stats.totalEntries).toBe(2);
    expect(stats.uniqueSourceModels).toBe(2);
    expect(stats.certificationDistribution.gold).toBe(1);
    expect(stats.certificationDistribution.silver).toBe(1);
    expect(stats.avgEpsilon).toBeCloseTo(0.055, 3);
  });
});

describe('WMatrixProtocolBuilder', () => {
  it('should build complete W-Matrix protocol', () => {
    const builder = new WMatrixProtocolBuilder();
    
    const protocol = builder
      .setVersion('1.0.0')
      .setStandard('4096')
      .setModelPair({
        sourceModel: 'gpt-3.5',
        targetModel: 'gpt-4',
        sourceDimension: 4096,
        targetDimension: 4096,
      })
      .setWeights([[1, 2], [3, 4]], [0.1, 0.2])
      .setCertification(QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000))
      .setDistribution('https://cdn.example.com/matrix.json', ['https://cdn1.example.com'])
      .build();
    
    expect(protocol.metadata.version).toEqual({ major: 1, minor: 0, patch: 0 });
    expect(protocol.metadata.standard).toBe('4096');
    expect(protocol.metadata.modelPair.sourceModel).toBe('gpt-3.5');
    expect(protocol.metadata.certification.level).toBe('gold');
    expect(protocol.metadata.checksumSHA256).toBeTruthy();
    expect(protocol.weights).toEqual([[1, 2], [3, 4]]);
    expect(protocol.biases).toEqual([0.1, 0.2]);
  });
  
  it('should throw error for missing required fields', () => {
    const builder = new WMatrixProtocolBuilder();
    
    expect(() => builder.build()).toThrow('Version is required');
  });
  
  it('should calculate checksum automatically', () => {
    const builder = new WMatrixProtocolBuilder();
    
    const protocol = builder
      .setVersion('1.0.0')
      .setStandard('4096')
      .setModelPair({
        sourceModel: 'gpt-3.5',
        targetModel: 'gpt-4',
        sourceDimension: 4096,
        targetDimension: 4096,
      })
      .setWeights([[1, 2], [3, 4]])
      .setCertification(QualityCertifier.createCertification(0.03, 0.95, 0.1, 1000))
      .build();
    
    expect(protocol.metadata.checksumSHA256).toHaveLength(64);
    expect(protocol.metadata.sizeBytes).toBeGreaterThan(0);
  });
});
