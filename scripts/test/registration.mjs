/**
 * Test registration endpoint
 */

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = "testpassword123";
const testName = "Test User";

console.log("Testing registration with:");
console.log("Email:", testEmail);
console.log("Password:", testPassword);
console.log("Name:", testName);
console.log("");

try {
  // tRPC requires input to be in a specific format
  const input = {
    email: testEmail,
    password: testPassword,
    name: testName,
  };

  const response = await fetch("http://localhost:3000/api/trpc/auth.registerEmail?input=" + encodeURIComponent(JSON.stringify(input)), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  console.log("Response status:", response.status);
  
  const data = await response.json();
  console.log("\nResponse data:", JSON.stringify(data, null, 2));

  if (data.result?.data?.success) {
    console.log("\n✅ Registration successful!");
    console.log("User ID:", data.result.data.userId);
  } else if (data.error) {
    console.log("\n❌ Registration failed!");
    console.log("Error:", data.error.json?.message || data.error.message || "Unknown error");
  } else {
    console.log("\n❌ Registration failed!");
    console.log("Error:", data.result?.data?.error || "Unknown error");
  }
} catch (error) {
  console.error("\n❌ Request failed:", error.message);
  console.error(error);
}
