#!/bin/bash
# Automated database migration script
# Automatically answers "create column" for all prompts

cd /home/ubuntu/latentmind-marketplace

# Use expect to automate interactive prompts
expect << 'EOF'
set timeout 120
spawn pnpm db:push

# Handle all "create or rename" prompts
expect {
    "create column" {
        send "\r"
        exp_continue
    }
    "rename column" {
        send "\r"
        exp_continue
    }
    "❯" {
        send "\r"
        exp_continue
    }
    "Successfully" {
        exit 0
    }
    timeout {
        puts "Migration timeout"
        exit 1
    }
    eof {
        exit 0
    }
}
EOF
