pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "your-dockerhub-username/node-blue-green"
        IMAGE_TAG = "${BUILD_NUMBER}"
        REGISTRY_CREDENTIALS = "docker-hub-credentials"
        
        BLUE_PORT = "3001"
        GREEN_PORT = "3002"
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    docker.withRegistry('', REGISTRY_CREDENTIALS) {
                        def customImage = docker.build("${DOCKER_IMAGE}:${IMAGE_TAG}")
                        customImage.push()
                        customImage.push("latest")
                    }
                }
            }
        }

        stage('Determine Active & Idle Environments') {
            steps {
                script {
                    // Check which environment Nginx is currently routing traffic to
                    def activePort = sh(script: "grep 'server 127.0.0.1:' /etc/nginx/conf.d/app.conf | grep -o '[0-9]*'", returnStdout: true).trim()
                    
                    if (activePort == BLUE_PORT) {
                        env.TARGET_ENV = "green"
                        env.TARGET_PORT = GREEN_PORT
                        env.IDLE_CONTAINER = "app-green"
                    } else {
                        env.TARGET_ENV = "blue"
                        env.TARGET_PORT = BLUE_PORT
                        env.IDLE_CONTAINER = "app-blue"
                    }
                    
                    echo "Current active port: ${activePort}"
                    echo "Deploying update to target environment: ${env.TARGET_ENV} on port ${env.TARGET_PORT}"
                }
            }
        }

        stage('Deploy to Idle Environment') {
            steps {
                script {
                    // Stop and remove existing container in idle environment if present
                    sh "docker stop ${env.IDLE_CONTAINER} || true"
                    sh "docker rm ${env.IDLE_CONTAINER} || true"

                    // Pull latest image and run on the target port
                    sh """
                        docker run -d \
                          --name ${env.IDLE_CONTAINER} \
                          -p ${env.TARGET_PORT}:3000 \
                          -e APP_COLOR=${env.TARGET_ENV.toUpperCase()} \
                          ${DOCKER_IMAGE}:${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "Running health check on http://127.0.0.1:${env.TARGET_PORT}/health..."
                    // Wait for the application to be healthy
                    sh """
                        for i in {1..10}; do
                          if curl -s http://127.0.0.1:${env.TARGET_PORT}/health | grep -q "OK"; then
                             echo "Target environment is healthy!"
                             exit 0
                          fi
                          echo "Waiting for app readiness..."
                          sleep 2
                        done
                        echo "Health check failed!"
                        exit 1
                    """
                }
            }
        }

        stage('Switch Traffic (Zero-Downtime Cutover)') {
            steps {
                script {
                    // Update Nginx upstream configuration to point to the newly deployed container
                    sh """
                        sudo sed -i 's/server 127.0.0.1:.*/server 127.0.0.1:${env.TARGET_PORT};/' /etc/nginx/conf.d/app.conf
                        sudo nginx -s reload
                    """
                    echo "Traffic successfully switched to ${env.TARGET_ENV} on port ${env.TARGET_PORT}"
                }
            }
        }
    }

    post {
        always {
            // Remove unused Docker images to clean up resources
            sh 'docker image prune -f'
        }
    }
}