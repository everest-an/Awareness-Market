import { spawn } from "child_process";
import path from "path";

export type ConversionResult = {
  converted_data: string;
  source_format: string;
  target_format: string;
};

export async function convertVectorFormat(params: {
  vectorData: string;
  sourceFormat: string;
  targetFormat: string;
}): Promise<ConversionResult> {
  const pythonCmd = process.env.VECTOR_CONVERTER_PY || "python";
  const scriptPath = path.join(process.cwd(), "scripts", "convert-vector.py");

  const payload = {
    vector_data: params.vectorData,
    source_format: params.sourceFormat,
    target_format: params.targetFormat,
  };

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Converter exited with code ${code}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as ConversionResult;
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
