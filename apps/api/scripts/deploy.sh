#!/bin/bash

# Clinical Interventions Module - Production Deployment Script
# This script handles the complete deployment process for the Clinical Interventions module

set -e  # Exit on any error

# Configuration
APP_NAME="pharmatech-api"
APP_DIR="/var/www/pharmatech-api"
BACKUP_DIR="/backup"
LOG_FILE="/var/log/deployment.log"
NODE_ENV="${NODE_ENV:-production}"
DEPLOYMENT_VERSION="${DEPLOYMENT_VERSION:-$(date +%Y%m%d_%H%M%S)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
    fi
}

# Validate environment
validate_environment() {
    log "Validating deployment environment..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        error "Node.js version 18 or higher is required. Current version: $(node --version)"
    fi
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Please install PM2: npm install -g pm2"
    fi
    
    # Check if MongoDB is accessible
    if ! npm run db:health-check &> /dev/null; then
        error "Cannot connect to MongoDB. Please check database configuration."
    fi
    
    # Check required environment variables
    required_vars=("NODE_ENV" "MONGODB_URI" "JWT_SECRET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    success "Environment validation completed"
}

# Create backup
create_backup() {
    log "Creating backup before deployment..."
    
    # Create backup directory with timestamp
    BACKUP_PATH="$BACKUP_DIR/deployment_backup_$DEPLOYMENT_VERSION"
    mkdir -p "$BACKUP_PATH"
    
    # Backup database
    log "Backing up database..."
    if ! mongodump --uri="$MONGODB_URI" --out="$BACKUP_PATH/database" &> /dev/null; then
        error "Database backup failed"
    fi
    
    # Backup application files
    log "Backing up application files..."
    if [[ -d "$APP_DIR" ]]; then
        tar -czf "$BACKUP_PATH/application.tar.gz" -C "$APP_DIR" . 2> /dev/null || true
    fi
    
    # Backup PM2 configuration
    log "Backing up PM2 configuration..."
    pm2 save &> /dev/null || true
    cp ~/.pm2/dump.pm2 "$BACKUP_PATH/pm2_dump.pm2" 2> /dev/null || true
    
    success "Backup created at $BACKUP_PATH"
}

# Stop application
stop_application() {
    log "Stopping application..."
    
    if pm2 list | grep -q "$APP_NAME"; then
        pm2 stop "$APP_NAME" &> /dev/null || true
        log "Application stopped"
    else
        log "Application is not running"
    fi
}

# Deploy application code
deploy_code() {
    log "Deploying application code..."
    
    # Navigate to application directory
    cd "$APP_DIR" || error "Cannot access application directory: $APP_DIR"
    
    # Pull latest code
    log "Pulling latest code from repository..."
    git fetch origin
    git checkout main
    git pull origin main
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production --silent
    
    # Build application
    log "Building application..."
    npm run build --silent
    
    success "Code deployment completed"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$APP_DIR" || error "Cannot access application directory"
    
    # Check migration status
    log "Checking migration status..."
    npm run migration:status
    
    # Apply pending migrations
    log "Applying pending migrations..."
    if ! npm run migration:up; then
        error "Database migration failed"
    fi
    
    # Validate migration integrity
    log "Validating migration integrity..."
    if ! npm run migration:validate; then
        error "Migration validation failed"
    fi
    
    success "Database migrations completed"
}

# Initialize feature flags
initialize_feature_flags() {
    log "Initializing feature flags..."
    
    cd "$APP_DIR" || error "Cannot access application directory"
    
    # Initialize default feature flags
    if ! npm run feature-flags:init; then
        warning "Feature flags initialization failed, continuing with deployment"
    fi
    
    # Configure gradual rollout for new features
    log "Configuring gradual rollout..."
    npm run feature-flags:set clinical_interventions_enabled --rollout 10 || true
    npm run feature-flags:set advanced_reporting_enabled --rollout 5 || true
    npm run feature-flags:set bulk_operations_enabled --rollout 0 || true
    
    success "Feature flags initialized"
}

# Setup performance monitoring
setup_monitoring() {
    log "Setting up performance monitoring..."
    
    cd "$APP_DIR" || error "Cannot access application directory"
    
    # Initialize performance monitoring
    npm run performance:init || warning "Performance monitoring initialization failed"
    
    # Create database indexes
    npm run db:optimize-indexes || warning "Database index optimization failed"
    
    # Initialize caching
    npm run cache:init || warning "Cache initialization failed"
    
    success "Performance monitoring setup completed"
}

# Start application
start_application() {
    log "Starting application..."
    
    cd "$APP_DIR" || error "Cannot access application directory"
    
    # Start application with PM2
    if pm2 list | grep -q "$APP_NAME"; then
        pm2 restart "$APP_NAME"
    else
        pm2 start ecosystem.config.js --env "$NODE_ENV"
    fi
    
    # Save PM2 configuration
    pm2 save
    
    # Wait for application to start
    sleep 10
    
    success "Application started"
}

# Health checks
run_health_checks() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        # Check application health
        if curl -f -s "http://localhost:${PORT:-5000}/api/health" > /dev/null; then
            success "Application health check passed"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Application health check failed after $max_attempts attempts"
        fi
        
        sleep 5
        ((attempt++))
    done
    
    # Additional health checks
    log "Running additional health checks..."
    
    # Database connectivity
    if ! curl -f -s "http://localhost:${PORT:-5000}/api/health/database" > /dev/null; then
        error "Database health check failed"
    fi
    
    # Clinical Interventions module
    if ! curl -f -s "http://localhost:${PORT:-5000}/api/clinical-interventions/health" > /dev/null; then
        error "Clinical Interventions health check failed"
    fi
    
    success "All health checks passed"
}

# Smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    cd "$APP_DIR" || error "Cannot access application directory"
    
    # Run smoke tests
    if ! npm run test:smoke; then
        error "Smoke tests failed"
    fi
    
    success "Smoke tests passed"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 10 backups
    if [[ -d "$BACKUP_DIR" ]]; then
        find "$BACKUP_DIR" -name "deployment_backup_*" -type d | sort -r | tail -n +11 | xargs rm -rf 2> /dev/null || true
    fi
    
    success "Old backups cleaned up"
}

# Rollback function
rollback() {
    local backup_path="$1"
    
    error "Deployment failed. Starting rollback..."
    
    if [[ -z "$backup_path" ]]; then
        error "No backup path provided for rollback"
    fi
    
    log "Rolling back to backup: $backup_path"
    
    # Stop application
    pm2 stop "$APP_NAME" &> /dev/null || true
    
    # Restore application files
    if [[ -f "$backup_path/application.tar.gz" ]]; then
        log "Restoring application files..."
        cd "$APP_DIR" || error "Cannot access application directory"
        tar -xzf "$backup_path/application.tar.gz" 2> /dev/null || true
    fi
    
    # Restore database (if needed)
    if [[ -d "$backup_path/database" ]]; then
        log "Database rollback may be needed. Please restore manually if required."
        warning "Database backup location: $backup_path/database"
    fi
    
    # Restore PM2 configuration
    if [[ -f "$backup_path/pm2_dump.pm2" ]]; then
        log "Restoring PM2 configuration..."
        cp "$backup_path/pm2_dump.pm2" ~/.pm2/dump.pm2 2> /dev/null || true
        pm2 resurrect &> /dev/null || true
    fi
    
    # Start application
    pm2 start "$APP_NAME" &> /dev/null || true
    
    error "Rollback completed. Please investigate the deployment failure."
}

# Main deployment function
main() {
    log "Starting Clinical Interventions Module deployment (Version: $DEPLOYMENT_VERSION)"
    
    # Set trap for rollback on error
    BACKUP_PATH="$BACKUP_DIR/deployment_backup_$DEPLOYMENT_VERSION"
    trap "rollback $BACKUP_PATH" ERR
    
    # Deployment steps
    check_permissions
    validate_environment
    create_backup
    stop_application
    deploy_code
    run_migrations
    initialize_feature_flags
    setup_monitoring
    start_application
    run_health_checks
    run_smoke_tests
    cleanup_old_backups
    
    # Clear trap
    trap - ERR
    
    success "Deployment completed successfully!"
    log "Deployment version: $DEPLOYMENT_VERSION"
    log "Backup location: $BACKUP_PATH"
    log "Application status: $(pm2 list | grep $APP_NAME || echo 'Not found')"
    
    # Display next steps
    echo ""
    echo "Next steps:"
    echo "1. Monitor application logs: pm2 logs $APP_NAME"
    echo "2. Check feature flag status: npm run feature-flags:status"
    echo "3. Monitor performance: npm run performance:check"
    echo "4. Gradually increase feature rollout percentages"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi