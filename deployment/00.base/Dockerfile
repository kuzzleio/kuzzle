FROM debian:wheezy
MAINTAINER Kaliop Labs

ENV TERM xterm-256color

RUN apt-get update && apt-get install -y \
    bash-completion \
    curl \
    dnsutils \
    git \
    netcat \
    vim \
    zsh && \
    apt-get clean

ADD http://nodejs.org/dist/v0.12.1/node-v0.12.1-linux-x64.tar.gz /root/
RUN tar xvf /root/node-v0.12.1-linux-x64.tar.gz -C /opt/ && \
    rm /root/node-v0.12.1-linux-x64.tar.gz && \
    ln -s /opt/node-v0.12.1-linux-x64/bin/* /usr/local/bin/
RUN npm install -g pm2

RUN chsh -s /bin/zsh && \
    curl -L https://raw.github.com/robbyrussell/oh-my-zsh/master/tools/install.sh | zsh && \
    sed -ri 's|ZSH_THEME="[^"]+"|ZSH_THEME="kardan"|' ~/.zshrc && \
    echo "export EDITOR=vim" >> ~/.zshrc
ADD profile /tmp/profile
RUN bash -c 'shopt -s dotglob; mv /tmp/profile/* /root/'

RUN git clone https://github.com/gmarik/Vundle.vim.git ~/.vim/bundle/Vundle.vim && \
    vim +PluginInstall +qall >/dev/null

RUN mkdir -p /var/app

WORKDIR /var/app
CMD ["zsh"]

