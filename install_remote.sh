#!/bin/bash

# Update and install dependencies
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y nodejs npm postgresql postgresql-contrib curl

# Setup database
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE dentalclinic OWNER postgres;" || true

# Change to the script's directory automatically
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Restore database dump if it exists
if [ -f "$SCRIPT_DIR/dentalclinic.dump" ]; then
    echo "Restoring database from dentalclinic.dump..."
    sudo -u postgres pg_restore -d dentalclinic -1 "$SCRIPT_DIR/dentalclinic.dump" || true
else
    echo "Warning: dentalclinic.dump not found in $SCRIPT_DIR. Skipping database restore."
fi

# Install Node dependencies
npm install
sudo npm install -g pm2

# Start the application via PM2
pm2 start npm --name "dentalclinic" -- run dev
pm2 save
pm2 startup
