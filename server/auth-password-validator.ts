/**
 * Password Strength Validator
 * 
 * Validates password strength and provides feedback.
 * 
 * ## Requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (optional but recommended)
 * - Not in common password list
 * - Not similar to email
 */

// Common weak passwords to reject
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "monkey", "master", "dragon", "111111",
  "baseball", "iloveyou", "trustno1", "sunshine", "princess", "welcome",
  "shadow", "superman", "michael", "football", "password1!", "admin",
  "letmein", "login", "starwars", "passw0rd", "hello", "charlie",
  "donald", "password2", "qwerty1", "aa123456", "access", "mustang",
]);

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: string[];
  suggestions: string[];
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  maxLength: number;
}

const DEFAULT_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Recommended but not required
  maxLength: 128,
};

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  email?: string,
  requirements: Partial<PasswordRequirements> = {}
): PasswordValidationResult {
  const config = { ...DEFAULT_REQUIREMENTS, ...requirements };
  const errors: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Length check
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters`);
  } else {
    score += 20;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
  }

  if (password.length > config.maxLength) {
    errors.push(`Password must be less than ${config.maxLength} characters`);
  }

  // Uppercase check
  const hasUppercase = /[A-Z]/.test(password);
  if (config.requireUppercase && !hasUppercase) {
    errors.push("Password must contain at least one uppercase letter");
  } else if (hasUppercase) {
    score += 15;
  } else {
    suggestions.push("Add uppercase letters for stronger password");
  }

  // Lowercase check
  const hasLowercase = /[a-z]/.test(password);
  if (config.requireLowercase && !hasLowercase) {
    errors.push("Password must contain at least one lowercase letter");
  } else if (hasLowercase) {
    score += 15;
  }

  // Number check
  const hasNumber = /[0-9]/.test(password);
  if (config.requireNumber && !hasNumber) {
    errors.push("Password must contain at least one number");
  } else if (hasNumber) {
    score += 15;
  } else {
    suggestions.push("Add numbers for stronger password");
  }

  // Special character check
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  if (config.requireSpecial && !hasSpecial) {
    errors.push("Password must contain at least one special character");
  } else if (hasSpecial) {
    score += 15;
  } else {
    suggestions.push("Add special characters (!@#$%^&*) for stronger password");
  }

  // Common password check
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common. Please choose a more unique password");
    score = Math.min(score, 20);
  }

  // Check if password contains email parts
  if (email) {
    const emailParts = email.toLowerCase().split(/[@.]/);
    const passwordLower = password.toLowerCase();
    
    for (const part of emailParts) {
      if (part.length >= 3 && passwordLower.includes(part)) {
        errors.push("Password should not contain parts of your email");
        score = Math.max(0, score - 20);
        break;
      }
    }
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(password)) {
    suggestions.push("Avoid repeating characters (e.g., 'aaa')");
    score = Math.max(0, score - 10);
  }

  // Check for sequential numbers or letters
  if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    suggestions.push("Avoid sequential characters (e.g., '123', 'abc')");
    score = Math.max(0, score - 10);
  }

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  return {
    valid: errors.length === 0,
    score,
    errors,
    suggestions: errors.length === 0 ? suggestions : [],
  };
}

/**
 * Get password strength label
 */
export function getPasswordStrengthLabel(score: number): {
  label: string;
  color: string;
} {
  if (score < 30) {
    return { label: "Weak", color: "red" };
  } else if (score < 50) {
    return { label: "Fair", color: "orange" };
  } else if (score < 70) {
    return { label: "Good", color: "yellow" };
  } else if (score < 90) {
    return { label: "Strong", color: "green" };
  } else {
    return { label: "Very Strong", color: "emerald" };
  }
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=";
  const all = uppercase + lowercase + numbers + special;

  let password = "";
  
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
