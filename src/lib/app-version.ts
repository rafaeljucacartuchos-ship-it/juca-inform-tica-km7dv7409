import pkg from '../../package.json'

/**
 * Versão do app em runtime (mesma do package.json, injetada no bundle).
 *
 * Era fixada em cada página (badge "v0.0.248" no header de "Usuários &
 * Permissões"), o que ficava stale após cada deploy. Agora o valor vem do
 * package.json em build time: sempre reflete a versão publicada.
 */
export const APP_VERSION: string = pkg.version
