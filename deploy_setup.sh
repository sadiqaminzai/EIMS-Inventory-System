#!/bin/bash

# EIMS Deployment Script
# Run this in your SSH session on the server

# Navigate to web directory
cd /home/u814835276/public_html/softcareitsolution.com

# Create EIMS folder if not exists
mkdir -p EIMS

cd EIMS

# Create backend folder structure
mkdir -p backend/storage/framework/{sessions,views,cache}
mkdir -p backend/storage/logs
mkdir -p backend/storage/app/public
mkdir -p backend/bootstrap/cache

# Set permissions
chmod -R 775 backend/storage
chmod -R 775 backend/bootstrap/cache

echo "Directory structure created!"
echo ""
echo "Now upload the files using SFTP or run the following on your local machine:"
echo ""
echo "From Windows PowerShell (run these commands locally):"
echo "scp -P 65002 -r c:/xampp/htdocs/EIMS/frontend/dist/* u814835276@213.130.145.253:/home/u814835276/public_html/softcareitsolution.com/EIMS/"
echo "scp -P 65002 -r c:/xampp/htdocs/EIMS/backend/* u814835276@213.130.145.253:/home/u814835276/public_html/softcareitsolution.com/EIMS/backend/"
