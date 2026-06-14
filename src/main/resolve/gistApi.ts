import axios from 'axios'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { getRuntimeConfigStr } from '../core/factory'
import { encryptAgeText } from '../utils/age'

interface GistInfo {
  id: string
  description: string
  html_url: string
}

const GIST_DESCRIPTION = 'Auto Synced Sparkle Runtime Config'
const GIST_FILE_NAME = 'sparkle.yaml'
const GIST_ENCRYPTED_FILE_NAME = 'sparkle.yaml.age'

function getGistFileName(encrypted: boolean): string {
  return encrypted ? GIST_ENCRYPTED_FILE_NAME : GIST_FILE_NAME
}

function getStaleGistFileName(encrypted: boolean): string {
  return encrypted ? GIST_FILE_NAME : GIST_ENCRYPTED_FILE_NAME
}

async function getGistUploadContent(): Promise<{ content: string; encrypted: boolean; fileName: string }> {
  const {
    gistEncrypted = false,
    gistAgeRecipient = ''
  } = await getAppConfig()
  const config = await getRuntimeConfigStr()
  const content = gistEncrypted ? await encryptAgeText(config, gistAgeRecipient) : config

  return {
    content,
    encrypted: gistEncrypted,
    fileName: getGistFileName(gistEncrypted)
  }
}

async function listGists(token: string): Promise<GistInfo[]> {
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const res = await axios.get('https://api.github.com/gists', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    ...(port != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port
      }
    }),
    responseType: 'json'
  })
  return res.data as GistInfo[]
}

async function createGist(token: string, fileName: string, content: string): Promise<void> {
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  return await axios.post(
    'https://api.github.com/gists',
    {
      description: GIST_DESCRIPTION,
      public: false,
      files: { [fileName]: { content } }
    },
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      ...(port != 0 && {
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port
        }
      })
    }
  )
}

async function updateGist(
  token: string,
  id: string,
  fileName: string,
  content: string,
  encrypted: boolean
): Promise<void> {
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  return await axios.patch(
    `https://api.github.com/gists/${id}`,
    {
      description: GIST_DESCRIPTION,
      files: {
        [fileName]: { content },
        [getStaleGistFileName(encrypted)]: null
      }
    },
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      ...(port != 0 && {
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port
        }
      })
    }
  )
}

export async function getGistUrl(): Promise<string> {
  const { githubToken, gistSyncEnabled = Boolean(githubToken) } = await getAppConfig()
  if (!gistSyncEnabled) return ''
  if (!githubToken) return ''
  const gists = await listGists(githubToken)
  const gist = gists.find((gist) => gist.description === GIST_DESCRIPTION)
  if (gist) {
    return gist.html_url
  } else {
    await uploadRuntimeConfig()
    const gists = await listGists(githubToken)
    const gist = gists.find((gist) => gist.description === GIST_DESCRIPTION)
    if (!gist) throw new Error('Gist not found')
    return gist.html_url
  }
}

export async function uploadRuntimeConfig(): Promise<void> {
  const { githubToken, gistSyncEnabled = Boolean(githubToken) } = await getAppConfig()
  if (!gistSyncEnabled) return
  if (!githubToken) return
  const gists = await listGists(githubToken)
  const gist = gists.find((gist) => gist.description === GIST_DESCRIPTION)
  const { content, encrypted, fileName } = await getGistUploadContent()
  if (gist) {
    await updateGist(githubToken, gist.id, fileName, content, encrypted)
  } else {
    await createGist(githubToken, fileName, content)
  }
}
