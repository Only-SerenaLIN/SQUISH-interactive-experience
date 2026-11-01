export const CONFIG=Object.freeze({
  world:{width:1200,height:2400},
  economy:{startingGlow:35,reproductionCost:50,baseGlowPerJelly:1,shellCost:30,shellBonus:1,slideCost:150,slideBonus:2,offlineCapSeconds:14400},
  species:{
    blue:{label:'Blue Jelly',personality:'Calm',color:'#9ecbff',accent:'#c8f2ff',speed:22,glow:1,habitat:'shell'},
    pink:{label:'Pink Jelly',personality:'Shy',color:'#ffafd3',accent:'#ffe0ee',speed:31,glow:1.12,habitat:'shell'},
    yellow:{label:'Golden Jelly',personality:'Playful',color:'#ffd77f',accent:'#fff0b8',speed:39,glow:1.28,habitat:'slide'}
  },
  habitats:{shell:{label:'Shell Rest',x:430,y:820,cost:30,bonus:1},slide:{label:'Jelly Slide',x:770,y:820,cost:150,bonus:2}}
});
