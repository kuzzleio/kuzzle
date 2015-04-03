set nocompatible
filetype off

set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

Plugin 'gmarik/Vundle.vim'
Plugin 'moll/vim-node'
Plugin 'jelera/vim-javascript-syntax'

call vundle#end()
filetype plugin indent on


syntax on
set background=dark
color hybrid
set laststatus=2
set expandtab
set ts=4
set sw=4
set showcmd
set cursorline
set wildmenu
set showmatch
set hlsearch
set paste
set autoindent
