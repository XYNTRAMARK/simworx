(() => {
  // Add future visual-system pages here when their public URLs are ready.
  const visualSolutions = [
    {
      title: 'LED screens',
      description: '3D configurator & instant quote',
      href: '/led-screen-configurator.html'
    },
    {
      title: 'Projector Configurator',
      description: 'Design your projection screen & projector layout',
      href: '/projection-screen-configurator-v50.html'
    }
  ];

  const initialise = () => {
    document.querySelectorAll('.global-header').forEach((header, index) => {
      if (header.dataset.navigationReady) return;
      const nav = header.querySelector('.global-nav');
      if (!nav) return;
      header.dataset.navigationReady = 'true';

      const toggle = header.querySelector('.global-toggle');
      let closeVisuals = () => {};
      let visualsTrigger;
      let visualsMenu;

      const setNavigationOpen = (open) => {
        header.classList.toggle('open', open);
        if (toggle) {
          toggle.setAttribute('aria-expanded', String(open));
          toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        }
        if (!open) closeVisuals();
      };

      if (toggle) {
        if (!nav.id) nav.id = `global-navigation-${index}`;
        toggle.setAttribute('aria-controls', nav.id);
        setNavigationOpen(header.classList.contains('open'));
        toggle.addEventListener('click', () => {
          setNavigationOpen(!header.classList.contains('open'));
        });
      }

      // Enhance the existing link, leaving its no-JavaScript fallback intact.
      const overview = Array.from(nav.querySelectorAll(':scope > a')).find((link) => {
        return new URL(link.href, document.baseURI).pathname === '/visual-systems.html';
      });

      if (overview) {
        const dropdown = document.createElement('div');
        dropdown.className = 'global-dropdown global-visuals';

        visualsTrigger = document.createElement('button');
        visualsTrigger.type = 'button';
        visualsTrigger.className = 'global-dropdown-trigger global-visuals-trigger';
        visualsTrigger.textContent = overview.textContent.trim();
        visualsTrigger.setAttribute('aria-expanded', 'false');
        visualsTrigger.setAttribute('aria-controls', `global-visual-solutions-${index}`);

        const chevron = document.createElement('span');
        chevron.className = 'global-visuals-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        visualsTrigger.append(chevron);

        visualsMenu = document.createElement('div');
        visualsMenu.id = `global-visual-solutions-${index}`;
        visualsMenu.className = 'global-dropdown-menu global-visuals-menu';
        visualsMenu.hidden = true;

        visualSolutions.forEach((solution) => {
          const link = document.createElement('a');
          link.href = solution.href;

          const title = document.createElement('span');
          title.className = 'global-visuals-title';
          title.textContent = solution.title;

          const description = document.createElement('span');
          description.className = 'global-visuals-description';
          description.textContent = solution.description;

          const arrow = document.createElement('span');
          arrow.className = 'global-visuals-arrow';
          arrow.textContent = '\u2192';
          arrow.setAttribute('aria-hidden', 'true');
          link.append(title, description, arrow);

          if (new URL(link.href, document.baseURI).pathname === window.location.pathname) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
            visualsTrigger.classList.add('active');
          }
          visualsMenu.append(link);
        });

        if (overview.classList.contains('active')) visualsTrigger.classList.add('active');
        dropdown.append(visualsTrigger, visualsMenu);
        overview.replaceWith(dropdown);

        const setVisualsOpen = (open) => {
          visualsMenu.hidden = !open;
          visualsTrigger.setAttribute('aria-expanded', String(open));
          dropdown.classList.toggle('is-open', open);
        };
        closeVisuals = () => setVisualsOpen(false);

        visualsTrigger.addEventListener('click', () => setVisualsOpen(visualsMenu.hidden));
        visualsTrigger.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setVisualsOpen(true);
            visualsMenu.querySelector('a').focus();
          }
        });
        dropdown.addEventListener('focusout', (event) => {
          if (!dropdown.contains(event.relatedTarget)) closeVisuals();
        });
        document.addEventListener('click', (event) => {
          if (!dropdown.contains(event.target)) closeVisuals();
        });
      }

      header.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (visualsMenu && !visualsMenu.hidden) {
          event.preventDefault();
          closeVisuals();
          visualsTrigger.focus();
        } else if (toggle && header.classList.contains('open')) {
          event.preventDefault();
          setNavigationOpen(false);
          toggle.focus();
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
