pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "pranathi0412/node-blue-green"
        IMAGE_TAG = "${BUILD_NUMBER}"
        REGISTRY_CREDENTIALS = "docker-hub-creds"
        
        BLUE_PORT = "3001"
        GREEN_PORT = "3002"
        NGINX_CONF = "/opt/homebrew/etc/nginx/conf.d/app.conf"
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                withCredentials([usernamePassword(credentialsId: "${REGISTRY_CREDENTIALS}", passwordVariable: 'DOCKER_PASSWORD', usernameVariable: 'DOCKER_USER')]) {
                    sh """
                        echo "\$DOCKER_PASSWORD" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker build -t ${DOCKER_IMAGE}:${IMAGE_TAG} .
                        docker tag ${DOCKER_IMAGE}:${IMAGE_TAG} ${DOCKER_IMAGE}:latest
                        docker push ${DOCKER_IMAGE}:${IMAGE_TAG}
                        docker push ${DOCKER_IMAGE}:latest
                    """
                }
            }
        }

        stage('Determine Active & Idle Environments') {
            steps {
                script {
                    def activePort = sh(script: "grep 'server 127.0.0.1:' ${NGINX_CONF} 2>/dev/null | grep -o '[0-9]*' || echo '${BLUE_PORT}'", returnStdout: true).trim()
                    
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
                    sh "docker stop ${env.IDLE_CONTAINER} || true"
                    sh "docker rm ${env.IDLE_CONTAINER} || true"

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
                    sh """
                        sed -i '' 's/server 127.0.0.1:.*/server 127.0.0.1:${env.TARGET_PORT};/' ${NGINX_CONF}
                        nginx -s reload
                    """
                    echo "Traffic successfully switched to ${env.TARGET_ENV} on port ${env.TARGET_PORT}"
                }
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f'
        }
    }
}