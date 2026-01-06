#!/bin/bash
# Automated database migration script
# Automatically selects "create column" for all prompts

set -e

cd "$(dirname "$0")/.."

echo "🔄 Starting automated database migration..."

# Generate migration with automatic "create column" selection
# Use yes command to automatically answer prompts
yes "" | pnpm drizzle-kit generate --name add_three_package_types 2>&1 | tee /tmp/drizzle-generate.log || true

# Check if generation was successful
if grep -q "error" /tmp/drizzle-generate.log; then
    echo "❌ Migration generation failed"
    cat /tmp/drizzle-generate.log
    exit 1
fi

echo "✅ Migration files generated"

# Apply migrations
echo "🚀 Applying migrations..."
pnpm drizzle-kit migrate 2>&1 | tee /tmp/drizzle-migrate.log

if grep -q "error" /tmp/drizzle-migrate.log; then
    echo "❌ Migration failed"
    cat /tmp/drizzle-migrate.log
    exit 1
fi

echo "✅ Database migration completed successfully!"
