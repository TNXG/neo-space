import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserModel } from '../models/user'

import { userApi } from '~/api/user'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserModel | null>(null)

  return {
    user,

    async fetchUser() {
      try {
        const $user = await userApi.getOwner()
        user.value = $user
      } catch {
        // 后端未配置主人时静默处理；登录流程会引导用户继续
      }
    },
  }
})

export { useUserStore as UserStore }
