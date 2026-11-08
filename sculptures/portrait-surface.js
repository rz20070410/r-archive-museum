// Register the four calibrated colour projections on the same three-dimensional surface.
window.portraitSurface = async function (group, source, diagonalSource) {
  const [texture,diagonalTexture] = await Promise.all([source,diagonalSource].map(src=>new THREE.TextureLoader().loadAsync(src)));
  texture.colorSpace = THREE.SRGBColorSpace;
  diagonalTexture.colorSpace=THREE.SRGBColorSpace;
  diagonalTexture.anisotropy=4;
  texture.anisotropy = 4;
  const uniforms = {views:{value:texture},diagonals:{value:diagonalTexture},orbit:{value:new THREE.Vector2(0,1)}};
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `
      varying vec3 modelPoint;
      varying vec3 surfaceNormal;
      void main() {
        modelPoint = position;
        surfaceNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
      }`,
    fragmentShader: `
      uniform sampler2D views;
      uniform sampler2D diagonals;
      uniform vec2 orbit;
      varying vec3 modelPoint;
      varying vec3 surfaceNormal;
      vec3 projectView(float x,float y,vec2 tile) {
        vec2 uv=(vec2(x,y)*250.+512.)/1024.;
        return texture2D(views,(clamp(uv,.001,.999)+tile)*.5).rgb;
      }
      vec3 diagonalView(float x,float y,vec2 tile) {
        return texture2D(diagonals,(clamp((vec2(x,y)*250.+512.)/1024.,.001,.999)+tile)*.5).rgb;
      }
      void main() {
        vec3 p=modelPoint, n=normalize(surfaceNormal);
        vec4 eye=max(vec4(orbit.y,orbit.x,-orbit.y,-orbit.x),0.);
        vec4 facing=max(vec4(n.z,n.x,-n.z,-n.x),0.);
        vec4 diagonalEye=max(.7071068*vec4(orbit.y+orbit.x,orbit.x-orbit.y,-orbit.y-orbit.x,orbit.y-orbit.x),0.);
        vec4 diagonalNormal=max(.7071068*vec4(n.z+n.x,n.x-n.z,-n.z-n.x,n.z-n.x),0.);
        vec4 w=pow(eye,vec4(17.))*(.25+facing);
        vec4 wd=pow(diagonalEye,vec4(17.))*(.25+diagonalNormal);
        float sum=max(dot(w+wd,vec4(1)),.00001); w/=sum; wd/=sum;
        vec3 c=w.x*projectView(p.x,p.y,vec2(0,1)) + w.y*projectView(-p.z,p.y,vec2(1,1))
              +w.z*projectView(-p.x,p.y,vec2(0,0)) + w.w*projectView(p.z,p.y,vec2(1,0));
        c+=wd.x*diagonalView(.7071068*(p.x-p.z),p.y,vec2(0,1))
          +wd.y*diagonalView(.7071068*(-p.x-p.z),p.y,vec2(1,1))
          +wd.z*diagonalView(.7071068*(-p.x+p.z),p.y,vec2(0,0))
          +wd.w*diagonalView(.7071068*(p.x+p.z),p.y,vec2(1,0));
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`
  });
  group.traverse(obj=>{if(obj.isMesh)obj.material=material});
  return angle=>uniforms.orbit.value.set(Math.sin(angle),Math.cos(angle));
};
