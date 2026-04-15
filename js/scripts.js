document.addEventListener('DOMContentLoaded', () => {

    // --- Loading Overlay Logic ---
    const loadingOverlay = document.getElementById('loading-overlay');
    window.addEventListener('load', () => {
        loadingOverlay.classList.add('hidden');
        // Remove from DOM after transition
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 500);
    });
    // Fallback: remove loader after 3 seconds anyway
    setTimeout(() => {
        if (!loadingOverlay.classList.contains('hidden')) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }, 3000);

    // Sort posts by date, oldest first
    posts.sort((a, b) => new Date(a.date) - new Date(b.date));

    const book = document.getElementById('book');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // --- Close Lightbox ---
    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightbox-close');

    const closeLightbox = () => {
        lightbox.classList.add('hidden');
    };

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) { // Only close if clicking on the background
            closeLightbox();
        }
    });
    
    // Explicitly handle close button click
    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling
        closeLightbox();
    });

    // --- Lightbox functionality ---
    const setupLightbox = (imgElement) => {
        imgElement.classList.add('cursor-pointer');
        
        imgElement.onerror = () => {
            imgElement.src = 'https://via.placeholder.com/400x400?text=Image+Not+Found';
        };
        
        imgElement.addEventListener('mousedown', (e) => e.stopPropagation());
        imgElement.addEventListener('mouseup', (e) => e.stopPropagation());
        imgElement.addEventListener('touchstart', (e) => e.stopPropagation());
        imgElement.addEventListener('touchend', (e) => e.stopPropagation());

        imgElement.addEventListener('click', (e) => {
            e.stopPropagation();

            const lightbox = document.getElementById('lightbox');
            const lightboxImg = document.getElementById('lightbox-img');
            const lightboxCaption = document.getElementById('lightbox-caption');
            
            let currentImageSrc = e.target.getAttribute('data-src') || e.target.getAttribute('src');
            
            lightboxImg.src = currentImageSrc;
            lightboxCaption.textContent = e.target.alt || '';
            lightbox.classList.remove('hidden');

            const music = document.getElementById('bg-music');
            const musicToggle = document.getElementById('music-toggle');
            const musicIcon = musicToggle.querySelector('i');
            
            if (music.paused) {
                music.play().then(() => {
                    musicIcon.classList.remove('fa-play');
                    musicIcon.classList.add('fa-pause');
                    if (typeof musicPlayedOnce !== 'undefined') {
                        musicPlayedOnce = true;
                    }
                }).catch(err => console.log("Audio play failed:", err));
            }
        });
    };

    // --- Page Rendering Logic ---
    const createPageElement = (post, index) => {
        const page = document.createElement('div');
        page.classList.add('page');
        page.setAttribute('data-page-index', index);

        let imageGallery = '';
        if (post.images && post.images.length > 0) {
            const rotation = Math.random() * 3 - 1.5;
            const displayImages = post.images.slice(0, 4);
            const count = displayImages.length;
            
            let gridClass = 'grid-cols-2';
            if (count === 1) gridClass = 'grid-cols-1';

            const imageItems = displayImages.map((img, i) => {
                let spanClass = 'aspect-square';
                if (count === 3 && i === 2) spanClass = 'col-span-2 w-1/2 mx-auto aspect-square';
                else if (count === 1) spanClass = 'w-full h-full flex items-center justify-center';

                // Use a placeholder for the src attribute
                return `<div class="${spanClass} overflow-hidden rounded shadow-sm relative group flex items-center justify-center ${count > 1 ? 'bg-gray-50' : ''}">
                            <img data-src="${img}" src="" alt="${post.title}" loading="lazy" class="w-full h-full object-contain bg-gray-50 hover:scale-105 transition-transform duration-500">
                        </div>`;
            }).join('');

            const imagesHTML = `<div class="grid ${gridClass} gap-2 w-full h-full content-center items-center justify-items-center">${imageItems}</div>`;
            let containerHeightClass = count === 2 ? 'h-48 sm:h-56' : 'h-64 sm:h-72';

            imageGallery = `<div class="polaroid-gallery mb-6">
                <div class="polaroid-frame p-3 bg-white shadow-lg mx-auto w-full max-w-sm ${containerHeightClass}" style="transform: rotate(${rotation}deg)">
                    ${imagesHTML}
                    <div class="polaroid-date font-handwriting text-gray-500 text-sm mt-2 text-center">${post.date}</div>
                </div>
            </div>`;
        }
        
        const tagsHTML = post.tags.map(tag => `<span class="text-xs font-medium bg-stone-200 text-stone-700 px-3 py-1 rounded-full border border-stone-300 shadow-sm">${tag}</span>`).join(' ');

        page.innerHTML = `
            <div class="page-content bg-[#fdfaf6] flex flex-col h-full p-6 sm:p-8 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-yellow-50 to-transparent rounded-bl-full opacity-50 pointer-events-none"></div>
                <div class="book-card flex-grow flex flex-col h-full border-2 border-dashed border-stone-300 rounded-xl p-5 sm:p-6 bg-white/50 relative">
                    <div class="absolute -top-3 -left-3 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-800 font-bold font-serif shadow-sm border border-yellow-200 z-10">
                        ${index + 1}
                    </div>
                    <h3 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center tracking-wide" style="font-family: 'Playfair Display', serif; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">${post.title}</h3>
                    <div class="flex justify-center w-full">${imageGallery}</div>
                    <div class="flex-grow overflow-y-auto my-4 scrollbar-thin scrollbar-thumb-stone-300 pr-2">
                        <p class="text-gray-700 text-base sm:text-lg leading-relaxed text-justify indent-8 font-serif">${post.content}</p>
                    </div>
                    <div class="mt-auto pt-4 border-t border-stone-200">
                         <div class="flex justify-center flex-wrap gap-2 mb-2">${tagsHTML}</div>
                         <div class="text-center text-xs text-gray-400 font-mono tracking-widest uppercase">Memory Fragment</div>
                    </div>
                </div>
            </div>
        `;
        
        return page;
    };

    const loadImagesOnPage = (pageElement) => {
        if (!pageElement || pageElement.dataset.imagesLoaded === 'true') {
            return;
        }
        const images = pageElement.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
            }
        });
        pageElement.dataset.imagesLoaded = 'true';
    };

    const renderInitialBook = () => {
        book.innerHTML = '';

        // --- Create Cover (Front) ---
        const coverSheet = document.createElement('div');
        coverSheet.classList.add('page', 'page-cover', 'page-cover-top');
        coverSheet.setAttribute('data-density', 'hard');
        coverSheet.innerHTML = `
            <div class="page-content flex flex-col items-center justify-center text-center bg-[#fdfaf6] h-full border-l-8 border-yellow-800 p-8 shadow-inner">
                <div class="border-4 border-double border-yellow-800/30 p-8 rounded-lg w-full h-full flex flex-col items-center justify-center">
                    <h1 class="text-5xl sm:text-6xl font-bold mb-6 text-yellow-900" style="font-family: 'Playfair Display', serif; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">缺牙巴们的<br>那些事</h1>
                    <p class="text-gray-600 mb-10 font-serif italic text-xl">我们的回忆录</p>
                    <div class="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-8 border-white shadow-xl mb-10 transform hover:scale-105 transition duration-500">
                        <img src="images/25/03021.webp" class="w-full h-full object-cover">
                    </div>
                    <div class="mt-auto">
                        <p class="text-lg text-gray-500 font-mono tracking-widest border-t border-b border-gray-300 py-2">2024 - 2026</p>
                    </div>
                    <div class="absolute bottom-4 right-4 text-gray-400 animate-bounce flex items-center gap-1 opacity-70">
                        <span class="text-xs">Flip</span>
                        <i class="fas fa-hand-point-right"></i>
                    </div>
                </div>
            </div>`;
        book.appendChild(coverSheet);

        // --- Create placeholders for all pages ---
        posts.forEach((post, index) => {
            const page = document.createElement('div');
            page.classList.add('page');
            page.setAttribute('data-page-index', index);
            // Add a simple placeholder to maintain structure
            page.innerHTML = `<div class="page-content bg-[#fdfaf6]"></div>`;
            book.appendChild(page);
        });

        // --- Create Back Cover ---
        const backCover = document.createElement('div');
        backCover.classList.add('page', 'page-cover', 'page-cover-bottom');
        backCover.setAttribute('data-density', 'hard');
        backCover.innerHTML = `
            <div class="page-content flex flex-col items-center justify-center text-center bg-[#fdfaf6] h-full border-r-8 border-yellow-800 p-8 shadow-inner">
                <div class="border-4 border-double border-yellow-800/30 p-8 rounded-lg w-full h-full flex flex-col items-center justify-center">
                    <h2 class="text-4xl font-bold mb-6 text-yellow-900" style="font-family: 'Playfair Display', serif;">The End</h2>
                    <p class="text-gray-500 mb-12 text-xl italic font-serif">To be continued...</p>
                    <div class="w-24 h-1 bg-yellow-800/20 mb-12"></div>
                     <div class="text-sm text-gray-400 font-mono">
                        <p>&copy; 2024 缺牙巴们的那些事</p>
                        <p class="mt-2 text-xs">Designed with ❤️</p>
                    </div>
                </div>
            </div>`;
        book.appendChild(backCover);
    };

    renderInitialBook();

    // --- Initialize StPageFlip ---
    // Wait for images to load or just init after a small delay
    setTimeout(() => {
        const pageFlip = new St.PageFlip(document.getElementById('book'), {
            width: 400, // base width
            height: 600, // base height
            size: 'stretch',
            minWidth: 300,
            maxWidth: 1000,
            minHeight: 400,
            maxHeight: 1200,
            maxShadowOpacity: 0.5,
            showCover: true,
            mobileScrollSupport: false // disable mobile scroll to prevent interference
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.page'));

        const updatePageContent = (pageIndex) => {
            if (pageIndex < 1 || pageIndex > posts.length) return;

            const pageElement = book.querySelector(`[data-page-index="${pageIndex - 1}"]`);
            if (pageElement && !pageElement.dataset.rendered) {
                const post = posts[pageIndex - 1];
                const newPage = createPageElement(post, pageIndex - 1);
                pageElement.innerHTML = newPage.innerHTML;
                pageElement.querySelectorAll('img[data-src]').forEach(setupLightbox);
                pageElement.dataset.rendered = 'true';
            }
        };

        // Preload initial pages for a smoother experience
        const initialPagesToLoad = 4;
        for (let i = 1; i <= initialPagesToLoad; i++) {
            updatePageContent(i);
        }
        // Load images for the first two pages that will be visible
        loadImagesOnPage(book.querySelector('[data-page-index="0"]'));
        loadImagesOnPage(book.querySelector('[data-page-index="1"]'));


        // --- Navigation Handlers ---
        nextBtn.addEventListener('click', () => {
            pageFlip.flipNext();
        });

        prevBtn.addEventListener('click', () => {
            pageFlip.flipPrev();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') pageFlip.flipNext();
            if (e.key === 'ArrowLeft') pageFlip.flipPrev();
        });

        // Handle page flipping and preloading
        pageFlip.on('flip', (e) => {
            // e.data is the page number of the right-hand page (1-based for content pages)
            const rightPageNum = e.data;

            // Define a preload buffer
            const preloadBuffer = 2; // Preload 2 pages (1 sheet) ahead

            // Ensure the pages coming into view are fully loaded
            const leftPageNum = rightPageNum - 1;
            updatePageContent(leftPageNum);
            updatePageContent(rightPageNum);
            loadImagesOnPage(book.querySelector(`[data-page-index="${leftPageNum - 1}"]`));
            loadImagesOnPage(book.querySelector(`[data-page-index="${rightPageNum - 1}"]`));

            // Preload pages ahead of the current view
            for (let i = 1; i <= preloadBuffer; i++) {
                const pageToPreload = rightPageNum + i;
                updatePageContent(pageToPreload);
                loadImagesOnPage(book.querySelector(`[data-page-index="${pageToPreload - 1}"]`));
            }

            // Easter egg trigger on last page
            if (e.data === pageFlip.getPageCount() - 1) {
                 setTimeout(triggerEasterEgg, 500);
            }
        });

    }, 100);


            // --- Easter Egg Logic: Floating Hearts ---
            let isEasterEggPlaying = false; // Define flag variable
            const triggerEasterEgg = () => {
                if (isEasterEggPlaying) return;
                isEasterEggPlaying = true;

                const message = document.getElementById('easter-egg-message');
                const container = document.getElementById('fireworks-container');
                
                // Show message gently
                message.classList.remove('opacity-0');
                container.classList.remove('opacity-0'); // Show container background gradient
                
                // Gentle Floating Hearts/Bubbles - More saturated colors
                const colors = ['#f472b6', '#60a5fa', '#a78bfa', '#facc15', '#a3e635', '#fb7185'];
                
                const createBubble = () => {
                    const bubble = document.createElement('div');
                    const size = Math.random() * 40 + 20; // 20px to 60px - Bigger
                    
                    bubble.classList.add('absolute', 'rounded-full', 'opacity-80', 'mix-blend-multiply'); // Higher opacity & blend mode
                    bubble.style.width = `${size}px`;
                    bubble.style.height = `${size}px`;
                    bubble.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                    bubble.style.left = `${Math.random() * 100}vw`;
                    bubble.style.bottom = '-60px';
                    
                    // Add a slight blur for a dreamy effect
                    // bubble.style.filter = 'blur(1px)'; // Removed blur for clarity
                    
                    container.appendChild(bubble);

                    // Keyframe Animation
                    const duration = Math.random() * 4000 + 3000; // 3s to 7s
                    const sway = Math.random() * 100 - 50; // -50px to 50px

                    const animation = bubble.animate([
                        { transform: 'translate(0, 0) scale(0.5)', opacity: 0 },
                        { transform: `translate(${sway * 0.2}px, -30vh) scale(1)`, opacity: 0.8, offset: 0.2 },
                        { transform: `translate(${sway}px, -90vh) scale(1.2)`, opacity: 0 }
                    ], {
                        duration: duration,
                        easing: 'ease-out'
                    });

                    animation.onfinish = () => bubble.remove();
                };

                // Create bubbles loop
                let count = 0;
                const interval = setInterval(() => {
                    createBubble();
                    count++;
                    if (count > 40) { // More bubbles
                        clearInterval(interval);
                        setTimeout(() => {
                             message.classList.add('opacity-0');
                             container.classList.add('opacity-0');
                             isEasterEggPlaying = false; 
                        }, 4000);
                    }
                }, 80); // Faster generation
            };

            // --- Helper: Throttle Function ---
            const throttle = (func, limit) => {
                let lastFunc;
                let lastRan;
                return function() {
                    const context = this;
                    const args = arguments;
                    if (!lastRan) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    } else {
                        clearTimeout(lastFunc);
                        lastFunc = setTimeout(function() {
                            if ((Date.now() - lastRan) >= limit) {
                                func.apply(context, args);
                                lastRan = Date.now();
                            }
                        }, limit - (Date.now() - lastRan));
                    }
                }
            };
            
            // Removed masonry scroll handler as it's not needed for the book
            
            // --- About Us Modal Logic ---
    const aboutUsLink = document.getElementById('about-us-link');
    const aboutUsModal = document.getElementById('about-us-modal');
    const aboutUsClose = document.getElementById('about-us-close');

    const openModal = () => {
        aboutUsModal.classList.remove('hidden');
        setTimeout(() => aboutUsModal.classList.add('is-visible'), 10); // Delay for transition
    };

    const closeModal = () => {
        aboutUsModal.classList.remove('is-visible');
        setTimeout(() => aboutUsModal.classList.add('hidden'), 300); // Match CSS transition duration
    };

    aboutUsLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    aboutUsClose.addEventListener('click', closeModal);
    aboutUsModal.addEventListener('click', (e) => {
                if (e.target === aboutUsModal) {
                    closeModal();
                }
            });

            // --- Music Player Logic ---
            // Defer music logic until first user interaction or scroll to save resources
            const initMusic = () => {
                const music = document.getElementById('bg-music');
                const musicToggle = document.getElementById('music-toggle');
                const musicIcon = musicToggle.querySelector('i');
                let musicPlayedOnce = false; // Flag for auto-play on scroll

                const handleFirstPlayOnScroll = throttle(() => {
                    if (!musicPlayedOnce && music.paused) {
                        music.play().then(() => {
                            musicIcon.classList.remove('fa-play');
                            musicIcon.classList.add('fa-pause');
                            musicPlayedOnce = true;
                            window.removeEventListener('scroll', handleFirstPlayOnScroll);
                        }).catch(error => {
                            // Silently fail or log for debug
                            // console.log("Auto-play prevented by browser policy");
                            window.removeEventListener('scroll', handleFirstPlayOnScroll);
                        });
                    }
                }, 1000); 

                window.addEventListener('scroll', handleFirstPlayOnScroll);

                musicToggle.addEventListener('click', () => {
                    if (music.paused) {
                        music.play().then(() => {
                            musicIcon.classList.remove('fa-play');
                            musicIcon.classList.add('fa-pause');
                        }).catch(e => console.error("Play failed", e));
                    } else {
                        music.pause();
                        musicIcon.classList.remove('fa-pause');
                        musicIcon.classList.add('fa-play');
                    }
                    if (!musicPlayedOnce) {
                        musicPlayedOnce = true;
                        window.removeEventListener('scroll', handleFirstPlayOnScroll);
                    }
                });
            };
            
            // Initialize music on load but execution logic is already event-driven
            initMusic();

            // --- Back to Top Logic ---
            const backToTopButton = document.getElementById('back-to-top');

            const handleBackToTopScroll = throttle(() => {
                if (window.scrollY > 400) { // Show button after scrolling 400px
                    backToTopButton.classList.add('is-visible');
                    backToTopButton.classList.remove('invisible', 'opacity-0');
                } else {
                    backToTopButton.classList.remove('is-visible');
                    backToTopButton.classList.add('invisible', 'opacity-0');
                }
            }, 200);

            window.addEventListener('scroll', handleBackToTopScroll);

            backToTopButton.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });

        });
