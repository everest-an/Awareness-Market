import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const testUser = await db.select().from(users).where(eq(users.email, "testuser@example.com")).limit(1);

if (testUser.length > 0) {
  console.log("✅ User found in database!");
  console.log("User ID:", testUser[0].id);
  console.log("Email:", testUser[0].email);
  console.log("Name:", testUser[0].name);
  console.log("Role:", testUser[0].role);
  console.log("Login Method:", testUser[0].loginMethod);
} else {
  console.log("❌ User not found in database");
}

await connection.end();
