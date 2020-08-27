# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.134.0/containers/javascript-node/.devcontainer/base.Dockerfile
ARG VARIANT="14"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-${VARIANT}

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node modules
# RUN sudo -u node npm install -g <your-package-list-here>

# Update
RUN apt-get update -y

# Upgrade
RUN apt-get upgrade -y

# Install dependencies
RUN apt-get install curl gnupg -y

# Add RabbitMQ GPG key
RUN curl -fsSL https://github.com/rabbitmq/signing-keys/releases/download/2.0/rabbitmq-release-signing-key.asc | apt-key add -

# Install RabbitMQ dependencies
RUN apt-get install apt-transport-https

# Update
RUN apt-get update -y

# Install RabbitMQ
RUN apt-get install rabbitmq-server -y --fix-missing

# Enable management plugin
RUN rabbitmq-plugins enable --offline rabbitmq_management

# Ensure RabbitMQ starts on boot
RUN update-rc.d rabbitmq-server defaults