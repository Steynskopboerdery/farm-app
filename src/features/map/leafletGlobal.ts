// Geoman (the drawing tool) expects Leaflet on window.L, so set it before Geoman loads.
import L from 'leaflet'

;(window as unknown as { L: typeof L }).L = L

export default L
